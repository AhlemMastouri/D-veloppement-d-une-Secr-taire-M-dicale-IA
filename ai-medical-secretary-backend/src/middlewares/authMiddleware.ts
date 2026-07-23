import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'medical-secretary-super-secret-key-123!';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    name: string;
  };
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Authorization: Bearer <token>

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Accès interdit: jeton invalide ou expiré' });
      }

      req.user = user as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'Accès non autorisé: jeton manquant' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Accès non autorisé: utilisateur non identifié' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Accès interdit: rôle ${req.user.role} insuffisant` });
    }

    next();
  };
};
