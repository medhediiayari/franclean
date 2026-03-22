import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production_please';

let io: Server | null = null;

export function initSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — verify JWT on connection
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Token manquant'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
      (socket as any).userId = decoded.userId;
      (socket as any).role = decoded.role;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    const role = (socket as any).role;

    // Join personal room for targeted messages
    socket.join(`user:${userId}`);

    // Admins join admin room
    if (role === 'admin') {
      socket.join('admins');
    }

    // Agents join agents room
    if (role === 'agent') {
      socket.join('agents');
    }

    console.log(`🔌 Socket connected: ${userId} (${role})`);

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${userId}`);
    });
  });

  console.log('⚡ Socket.IO initialized');
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocketIO first');
  }
  return io;
}

// ──────────────────────────────────────────────────────────
// Helper emitters — used from route handlers
// ──────────────────────────────────────────────────────────

/** Broadcast to everyone that events data changed */
export function emitEventsChanged() {
  console.log('📡 Emitting events:changed to', io?.engine?.clientsCount ?? 0, 'clients');
  io?.emit('events:changed');
}

/** Broadcast to everyone that attendance data changed */
export function emitAttendanceChanged() {
  console.log('📡 Emitting attendance:changed to', io?.engine?.clientsCount ?? 0, 'clients');
  io?.emit('attendance:changed');
}

/** Broadcast to everyone that users data changed */
export function emitUsersChanged() {
  console.log('📡 Emitting users:changed to', io?.engine?.clientsCount ?? 0, 'clients');
  io?.emit('users:changed');
}

/** Send a targeted notification to a specific user */
export function emitToUser(userId: string, event: string, data?: unknown) {
  console.log(`📡 Emitting ${event} to user:${userId}`);
  io?.to(`user:${userId}`).emit(event, data);
}

/** Send to all admins */
export function emitToAdmins(event: string, data?: unknown) {
  console.log(`📡 Emitting ${event} to admins room`);
  io?.to('admins').emit(event, data);
}

/** Send to all agents */
export function emitToAgents(event: string, data?: unknown) {
  io?.to('agents').emit(event, data);
}
