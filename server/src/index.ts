import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocketIO } from './lib/socket.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import attendanceRoutes from './routes/attendance.js';
import clientRoutes from './routes/clients.js';
import paymentRoutes from './routes/payments.js';
import clientPortalRoutes from './routes/clientPortal.js';

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Socket.IO
initSocketIO(httpServer);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/client-portal', clientPortalRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Bipbip API running on http://localhost:${PORT}`);
});
