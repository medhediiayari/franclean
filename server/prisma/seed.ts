import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.attendance.deleteMany();
  await prisma.eventHistory.deleteMany();
  await prisma.eventAgent.deleteMany();
  await prisma.eventShift.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  // ── Users ───────────────────────────────────────────
  const admin1 = await prisma.user.create({
    data: {
      id: 'admin-1',
      firstName: 'Mohamed',
      lastName: 'Admin',
      email: 'admin@franclean.fr',
      password: hash('admin123'),
      phone: '+33 6 12 34 56 78',
      role: 'admin',
      isActive: true,
    },
  });

  const agent1 = await prisma.user.create({
    data: {
      id: 'agent-1',
      firstName: 'Ahmed',
      lastName: 'Benali',
      email: 'ahmed@franclean.fr',
      password: hash('agent123'),
      phone: '+33 6 22 33 44 55',
      role: 'agent',
      isActive: true,
    },
  });

  const agent2 = await prisma.user.create({
    data: {
      id: 'agent-2',
      firstName: 'Sara',
      lastName: 'Mansouri',
      email: 'sara@franclean.fr',
      password: hash('agent123'),
      phone: '+33 6 33 44 55 66',
      role: 'agent',
      isActive: true,
    },
  });

  const agent3 = await prisma.user.create({
    data: {
      id: 'agent-3',
      firstName: 'Karim',
      lastName: 'Dupont',
      email: 'karim@franclean.fr',
      password: hash('agent123'),
      phone: '+33 6 44 55 66 77',
      role: 'agent',
      isActive: true,
    },
  });

  const agent4 = await prisma.user.create({
    data: {
      id: 'agent-4',
      firstName: 'Fatima',
      lastName: 'El Amrani',
      email: 'fatima@franclean.fr',
      password: hash('agent123'),
      phone: '+33 6 55 66 77 88',
      role: 'agent',
      isActive: false,
    },
  });

  // ── Helper dates ────────────────────────────────────
  const now = new Date();
  const d = (offset: number) => {
    const dt = new Date(now.getTime() + offset * 86400000);
    return new Date(dt.toISOString().slice(0, 10));
  };

  const today = d(0);
  const yesterday = d(-1);
  const twoDaysAgo = d(-2);
  const threeDaysAgo = d(-3);
  const fiveDaysAgo = d(-5);
  const tomorrow = d(1);
  const dayAfter = d(2);
  const inThreeDays = d(3);
  const inFourDays = d(4);
  const inFiveDays = d(5);

  // ── Events ──────────────────────────────────────────

  // EVT-1: Agent-1 today - en_cours
  const evt1 = await prisma.event.create({
    data: {
      title: 'Nettoyage Bureau Central',
      description: 'Nettoyage complet des bureaux du 3ème étage',
      client: 'Société Générale',
      color: '#6366F1',
      startDate: today,
      endDate: today,
      address: '29 Boulevard Haussmann, 75009 Paris',
      latitude: 48.8738,
      longitude: 2.337,
      geoRadius: 200,
      status: 'en_cours',
      shifts: {
        create: [
          { date: today, startTime: '08:00', endTime: '12:00' },
          { date: today, startTime: '14:00', endTime: '17:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id, timestamp: new Date(yesterday.getTime() + 36000000) },
          { action: 'Accepté par agent', userId: agent1.id, timestamp: new Date(yesterday.getTime() + 39600000) },
        ],
      },
    },
  });

  // EVT-7: Agent-1 today evening - en_cours
  await prisma.event.create({
    data: {
      title: "Entretien Cage d'Escalier Immeuble B",
      description: "Nettoyage cage d'escalier et paliers du RDC au 6ème",
      client: 'Foncia Paris',
      color: '#8B5CF6',
      startDate: today,
      endDate: today,
      address: '88 Rue de la Pompe, 75016 Paris',
      latitude: 48.863,
      longitude: 2.2756,
      geoRadius: 150,
      status: 'en_cours',
      shifts: {
        create: [{ date: today, startTime: '18:00', endTime: '20:00' }],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent1.id },
        ],
      },
    },
  });

  // EVT-8: Agent-1 yesterday - termine
  const evt8 = await prisma.event.create({
    data: {
      title: 'Nettoyage Showroom Automobile',
      description: 'Lavage sols, vitres et présentoirs du showroom',
      client: 'Renault Paris Étoile',
      color: '#EC4899',
      startDate: yesterday,
      endDate: yesterday,
      address: '53 Avenue de la Grande Armée, 75116 Paris',
      latitude: 48.876,
      longitude: 2.285,
      geoRadius: 200,
      status: 'termine',
      shifts: {
        create: [
          { date: yesterday, startTime: '07:00', endTime: '12:00' },
          { date: yesterday, startTime: '13:00', endTime: '15:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent1.id },
          { action: 'Terminé', userId: agent1.id },
        ],
      },
    },
  });

  // EVT-9: Agent-1 threeDaysAgo - termine
  const evt9 = await prisma.event.create({
    data: {
      title: 'Désinfection Restaurant Le Petit Zinc',
      description: 'Désinfection cuisine et salle après fermeture sanitaire',
      client: 'Le Petit Zinc',
      color: '#F59E0B',
      startDate: threeDaysAgo,
      endDate: threeDaysAgo,
      address: '11 Rue Saint-Benoît, 75006 Paris',
      latitude: 48.854,
      longitude: 2.333,
      geoRadius: 100,
      status: 'termine',
      shifts: {
        create: [{ date: threeDaysAgo, startTime: '06:00', endTime: '12:00' }],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent1.id },
          { action: 'Terminé', userId: agent1.id },
        ],
      },
    },
  });

  // EVT-10: Agent-1 fiveDaysAgo - termine
  const evt10 = await prisma.event.create({
    data: {
      title: 'Remise en état Appartement T3',
      description: 'Nettoyage complet après travaux de rénovation',
      client: 'Century 21 Paris',
      color: '#10B981',
      startDate: fiveDaysAgo,
      endDate: fiveDaysAgo,
      address: '130 Rue de Rivoli, 75001 Paris',
      latitude: 48.86,
      longitude: 2.34,
      geoRadius: 150,
      status: 'termine',
      shifts: {
        create: [
          { date: fiveDaysAgo, startTime: '08:00', endTime: '12:00' },
          { date: fiveDaysAgo, startTime: '13:00', endTime: '16:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent1.id },
          { action: 'Terminé', userId: agent1.id },
        ],
      },
    },
  });

  // EVT-4: Agent-1 tomorrow - planifie
  await prisma.event.create({
    data: {
      title: 'Vitrerie Tour Montparnasse',
      description: 'Nettoyage des vitres - Niveaux 1 à 5',
      client: 'Tour Montparnasse SA',
      color: '#3B82F6',
      startDate: tomorrow,
      endDate: tomorrow,
      address: '33 Avenue du Maine, 75015 Paris',
      latitude: 48.8421,
      longitude: 2.3219,
      geoRadius: 200,
      status: 'planifie',
      shifts: {
        create: [
          { date: tomorrow, startTime: '08:00', endTime: '12:00' },
          { date: tomorrow, startTime: '13:00', endTime: '17:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'pending' }],
      },
      history: {
        create: [{ action: 'Création', userId: admin1.id }],
      },
    },
  });

  // EVT-11: Agent-1 inThreeDays
  await prisma.event.create({
    data: {
      title: 'Nettoyage Salle de Sport',
      description: 'Nettoyage vestiaires, douches et espace fitness',
      client: 'Fitness Park',
      color: '#14B8A6',
      startDate: inThreeDays,
      endDate: inThreeDays,
      address: '5 Rue de Bercy, 75012 Paris',
      latitude: 48.8396,
      longitude: 2.3826,
      geoRadius: 200,
      status: 'planifie',
      shifts: {
        create: [{ date: inThreeDays, startTime: '06:00', endTime: '10:00' }],
      },
      agents: {
        create: [{ agentId: agent1.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent1.id },
        ],
      },
    },
  });

  // EVT-12: Agent-1 + Agent-2 inFourDays (multi-agent)
  await prisma.event.create({
    data: {
      title: 'Entretien Siège Social TechCorp',
      description: 'Nettoyage open space, salles de réunion et cafétéria',
      client: 'TechCorp',
      color: '#F97316',
      startDate: inFourDays,
      endDate: inFiveDays,
      address: '100 Avenue des Champs-Élysées, 75008 Paris',
      latitude: 48.871,
      longitude: 2.303,
      geoRadius: 250,
      status: 'planifie',
      shifts: {
        create: [
          { date: inFourDays, startTime: '09:00', endTime: '13:00' },
          { date: inFourDays, startTime: '14:00', endTime: '18:00' },
          { date: inFiveDays, startTime: '09:00', endTime: '13:00' },
        ],
      },
      agents: {
        create: [
          { agentId: agent1.id, response: 'pending' },
          { agentId: agent2.id, response: 'pending' },
        ],
      },
      history: {
        create: [{ action: 'Création', userId: admin1.id }],
      },
    },
  });

  // EVT-2: Agent-2 today - en_cours
  const evt2 = await prisma.event.create({
    data: {
      title: 'Entretien Résidence Les Lilas',
      description: 'Entretien des parties communes - Hall et escaliers',
      client: 'Nexity',
      color: '#EF4444',
      startDate: today,
      endDate: today,
      address: '15 Rue des Lilas, 93260 Les Lilas',
      latitude: 48.8796,
      longitude: 2.4189,
      geoRadius: 150,
      status: 'en_cours',
      shifts: {
        create: [
          { date: today, startTime: '09:00', endTime: '12:00' },
          { date: today, startTime: '13:00', endTime: '16:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent2.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent2.id },
        ],
      },
    },
  });

  // EVT-5: Agent-2 yesterday - termine
  await prisma.event.create({
    data: {
      title: 'Désinfection Clinique',
      description: 'Désinfection complète des salles de consultation',
      client: 'Clinique Saint-Joseph',
      color: '#A855F7',
      startDate: yesterday,
      endDate: yesterday,
      address: '185 Rue Raymond Losserand, 75014 Paris',
      latitude: 48.8333,
      longitude: 2.3133,
      geoRadius: 100,
      status: 'termine',
      shifts: {
        create: [
          { date: yesterday, startTime: '06:00', endTime: '10:00' },
          { date: yesterday, startTime: '11:00', endTime: '14:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent2.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent2.id },
          { action: 'Terminé', userId: agent2.id },
        ],
      },
    },
  });

  // EVT-13: Agent-2 twoDaysAgo - termine
  await prisma.event.create({
    data: {
      title: "Lavage Vitres Hôtel Mercure",
      description: "Nettoyage vitres hall d'entrée et restaurant",
      client: 'Hôtel Mercure Bastille',
      color: '#0EA5E9',
      startDate: twoDaysAgo,
      endDate: twoDaysAgo,
      address: '4 Boulevard Beaumarchais, 75011 Paris',
      latitude: 48.8533,
      longitude: 2.3681,
      geoRadius: 150,
      status: 'termine',
      shifts: {
        create: [{ date: twoDaysAgo, startTime: '07:30', endTime: '13:00' }],
      },
      agents: {
        create: [{ agentId: agent2.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent2.id },
          { action: 'Terminé', userId: agent2.id },
        ],
      },
    },
  });

  // EVT-14: Agent-2 tomorrow - planifie
  await prisma.event.create({
    data: {
      title: 'Nettoyage Cabinet Médical',
      description: 'Entretien quotidien cabinet de 3 praticiens',
      client: 'Dr. Martin & Associés',
      color: '#D946EF',
      startDate: tomorrow,
      endDate: tomorrow,
      address: '22 Rue de Passy, 75016 Paris',
      latitude: 48.857,
      longitude: 2.281,
      geoRadius: 100,
      status: 'planifie',
      shifts: {
        create: [{ date: tomorrow, startTime: '17:00', endTime: '20:00' }],
      },
      agents: {
        create: [{ agentId: agent2.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent2.id },
        ],
      },
    },
  });

  // EVT-3: Agent-3 + Agent-1 tomorrow-dayAfter (multi-agent)
  await prisma.event.create({
    data: {
      title: 'Nettoyage Chantier BTP',
      description: 'Nettoyage de fin de chantier - 2 étages',
      client: 'Bouygues Construction',
      color: '#84CC16',
      startDate: tomorrow,
      endDate: dayAfter,
      address: '42 Avenue de la République, 75011 Paris',
      latitude: 48.8654,
      longitude: 2.3817,
      geoRadius: 300,
      status: 'planifie',
      shifts: {
        create: [
          { date: tomorrow, startTime: '07:00', endTime: '12:00' },
          { date: tomorrow, startTime: '13:00', endTime: '18:00' },
          { date: dayAfter, startTime: '07:00', endTime: '12:00' },
          { date: dayAfter, startTime: '13:00', endTime: '18:00' },
        ],
      },
      agents: {
        create: [
          { agentId: agent3.id, response: 'pending' },
          { agentId: agent1.id, response: 'accepted' },
        ],
      },
      history: {
        create: [{ action: 'Création', userId: admin1.id }],
      },
    },
  });

  // EVT-15: Agent-3 today - en_cours
  await prisma.event.create({
    data: {
      title: 'Entretien Crèche Les Petits Lutins',
      description: 'Nettoyage et désinfection des salles de jeux et dortoirs',
      client: 'Crèche Les Petits Lutins',
      color: '#F43F5E',
      startDate: today,
      endDate: today,
      address: '75 Rue de la Convention, 75015 Paris',
      latitude: 48.84,
      longitude: 2.296,
      geoRadius: 100,
      status: 'en_cours',
      shifts: {
        create: [{ date: today, startTime: '18:00', endTime: '21:00' }],
      },
      agents: {
        create: [{ agentId: agent3.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent3.id },
        ],
      },
    },
  });

  // EVT-6: Agent-4 today - a_reattribuer (refused)
  await prisma.event.create({
    data: {
      title: 'Nettoyage Entrepôt Logistique',
      description: 'Nettoyage sol et zones de stockage',
      client: 'Amazon Logistics',
      color: '#64748B',
      startDate: today,
      endDate: today,
      address: '1 Rue de la Logistique, 93200 Saint-Denis',
      latitude: 48.9362,
      longitude: 2.3574,
      geoRadius: 500,
      status: 'a_reattribuer',
      shifts: {
        create: [
          { date: today, startTime: '06:00', endTime: '10:00' },
          { date: today, startTime: '11:00', endTime: '14:00' },
        ],
      },
      agents: {
        create: [{ agentId: agent4.id, response: 'refused' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Refusé par agent', userId: agent4.id, details: 'Agent indisponible' },
        ],
      },
    },
  });

  // EVT-16: Agent-4 today - en_cours
  await prisma.event.create({
    data: {
      title: 'Nettoyage Boutique Zara',
      description: "Lavage sols, miroirs et cabines d'essayage",
      client: 'Inditex France',
      color: '#EA580C',
      startDate: today,
      endDate: today,
      address: '44 Avenue des Champs-Élysées, 75008 Paris',
      latitude: 48.87,
      longitude: 2.305,
      geoRadius: 200,
      status: 'en_cours',
      shifts: {
        create: [{ date: today, startTime: '20:00', endTime: '23:00' }],
      },
      agents: {
        create: [{ agentId: agent4.id, response: 'accepted' }],
      },
      history: {
        create: [
          { action: 'Création', userId: admin1.id },
          { action: 'Accepté par agent', userId: agent4.id },
        ],
      },
    },
  });

  // ── Attendance records ──────────────────────────────
  // Get shift IDs for evt1
  const evt1Shifts = await prisma.eventShift.findMany({ where: { eventId: evt1.id }, orderBy: { startTime: 'asc' } });

  // ATT-1: Agent-1 today evt-1 check-in done
  await prisma.attendance.create({
    data: {
      eventId: evt1.id,
      shiftId: evt1Shifts[0]?.id,
      agentId: agent1.id,
      date: today,
      checkInTime: new Date(`${today.toISOString().slice(0, 10)}T08:05:00Z`),
      checkInPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%234F46E5" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Entrée</text></svg>',
      checkInLatitude: 48.8739,
      checkInLongitude: 2.3371,
      checkInLocationValid: true,
      status: 'en_attente',
    },
  });

  // ATT-6: Agent-1 yesterday evt-8 complete
  await prisma.attendance.create({
    data: {
      eventId: evt8.id,
      agentId: agent1.id,
      date: yesterday,
      checkInTime: new Date(`${yesterday.toISOString().slice(0, 10)}T07:10:00Z`),
      checkInPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%230EA5E9" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Entrée Showroom</text></svg>',
      checkInLatitude: 48.8761,
      checkInLongitude: 2.2851,
      checkInLocationValid: true,
      checkOutTime: new Date(`${yesterday.toISOString().slice(0, 10)}T15:05:00Z`),
      checkOutPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23F97316" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Sortie Showroom</text></svg>',
      checkOutLatitude: 48.876,
      checkOutLongitude: 2.2849,
      checkOutLocationValid: true,
      hoursWorked: 7.92,
      status: 'valide',
      validatedBy: admin1.id,
      validatedAt: new Date(`${yesterday.toISOString().slice(0, 10)}T16:00:00Z`),
    },
  });

  // ATT-7: Agent-1 threeDaysAgo evt-9 suspect
  await prisma.attendance.create({
    data: {
      eventId: evt9.id,
      agentId: agent1.id,
      date: threeDaysAgo,
      checkInTime: new Date(`${threeDaysAgo.toISOString().slice(0, 10)}T06:08:00Z`),
      checkInPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%2310B981" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Entrée Restaurant</text></svg>',
      checkInLatitude: 48.8541,
      checkInLongitude: 2.3331,
      checkInLocationValid: true,
      checkOutTime: new Date(`${threeDaysAgo.toISOString().slice(0, 10)}T12:15:00Z`),
      checkOutPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23EF4444" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Sortie Restaurant</text></svg>',
      checkOutLatitude: 48.87,
      checkOutLongitude: 2.35,
      checkOutLocationValid: false,
      hoursWorked: 6.12,
      status: 'suspect',
      isSuspect: true,
      suspectReasons: ['Localisation hors zone à la sortie (1.8km)'],
    },
  });

  // ATT-8: Agent-1 fiveDaysAgo evt-10 valide
  await prisma.attendance.create({
    data: {
      eventId: evt10.id,
      agentId: agent1.id,
      date: fiveDaysAgo,
      checkInTime: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T08:02:00Z`),
      checkInPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%238B5CF6" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Entrée Appart</text></svg>',
      checkInLatitude: 48.8601,
      checkInLongitude: 2.3401,
      checkInLocationValid: true,
      checkOutTime: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T15:55:00Z`),
      checkOutPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23EC4899" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Sortie Appart</text></svg>',
      checkOutLatitude: 48.86,
      checkOutLongitude: 2.3399,
      checkOutLocationValid: true,
      hoursWorked: 7.88,
      status: 'valide',
      validatedBy: admin1.id,
      validatedAt: new Date(`${fiveDaysAgo.toISOString().slice(0, 10)}T17:00:00Z`),
    },
  });

  // ATT: Agent-2 today evt-2 check-in
  await prisma.attendance.create({
    data: {
      eventId: evt2.id,
      agentId: agent2.id,
      date: today,
      checkInTime: new Date(`${today.toISOString().slice(0, 10)}T09:10:00Z`),
      checkInPhotoUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23EF4444" width="400" height="300" rx="8"/><text x="200" y="150" text-anchor="middle" fill="white" font-size="18">Photo Entrée Résidence</text></svg>',
      checkInLatitude: 48.8797,
      checkInLongitude: 2.419,
      checkInLocationValid: true,
      status: 'en_attente',
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Comptes de connexion :');
  console.log('  Admin  → admin@franclean.fr / admin123');
  console.log('  Agent1 → ahmed@franclean.fr / agent123');
  console.log('  Agent2 → sara@franclean.fr / agent123');
  console.log('  Agent3 → karim@franclean.fr / agent123');
  console.log('  Agent4 → fatima@franclean.fr / agent123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
