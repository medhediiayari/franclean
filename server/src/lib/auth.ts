import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production_please';

export interface AuthPayload {
  userId: string;
  role: 'admin' | 'agent';
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' });
    return;
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    return;
  }
  next();
}
