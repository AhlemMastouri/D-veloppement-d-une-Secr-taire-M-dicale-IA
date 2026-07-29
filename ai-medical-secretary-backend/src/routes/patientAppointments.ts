import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/patient/appointments - patient sees own appointments
router.get('/', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({ error: `Accès interdit: rôle ${req.user.role} insuffisant` });
    }
    const appointments = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      include: { doctor: { select: { id: true, name: true, specialty: true } } },
      orderBy: { startTime: 'desc' },
    });
    return res.json({ appointments });
  } catch (error: any) {
    console.error('Erreur GET /patient/appointments:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
