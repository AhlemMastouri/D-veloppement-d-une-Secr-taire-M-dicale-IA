import { Router, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'medical-secretary-super-secret-key-123!';

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, isPatientSpace } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email ou numéro de téléphone requis' });
    }

    // 1. Chercher d'abord dans la table Utilisateurs (Médecin, Secrétaire, Admin)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      if (password) {
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Mot de passe incorrect' });
        }
      }

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          specialty: user.specialty,
        },
      });
    }

    // 2. Si non trouvé dans User, chercher dans la table Patient (par email ou par téléphone)
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [
          { email: email },
          { phone: email }
        ]
      }
    });

    if (patient) {
      const token = jwt.sign(
        {
          id: patient.id,
          email: patient.email || patient.phone,
          role: 'PATIENT',
          name: `${patient.firstName} ${patient.lastName}`,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: patient.id,
          email: patient.email || patient.phone,
          name: `${patient.firstName} ${patient.lastName}`,
          role: 'PATIENT',
          phone: patient.phone,
          insurance: patient.insurance,
        },
      });
    }

    return res.status(401).json({ error: 'Compte introuvable (Vérifiez votre email ou téléphone)' });
  } catch (error: any) {
    console.error('Erreur de connexion:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        specialty: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    return res.json({ user });
  } catch (error: any) {
    console.error('Erreur GET /me:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
