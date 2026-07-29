import { Router, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'medical-secretary-super-secret-key-123!';

// Mapping rôle front (FR) -> rôle stocké en DB
const ROLE_MAP: Record<string, string> = {
  MEDECIN: 'DOCTOR',
  SECRETAIRE: 'SECRETARY',
  ADMIN: 'ADMIN',
};

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
      // Si le patient a un mot de passe enregistré, il doit être vérifié.
      // Sinon (compte créé par le secrétariat sans mot de passe), on laisse passer.
      if (patient.password) {
        if (!password) {
          return res.status(401).json({ error: 'Mot de passe requis' });
        }
        const isPasswordValid = bcrypt.compareSync(password, patient.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: 'Mot de passe incorrect' });
        }
      }

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

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      isPatientSpace,
      phone,
      birthDate,
      role,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // --- Inscription Patient ---
    if (isPatientSpace) {
      if (!phone) {
        return res.status(400).json({ error: 'Numéro de téléphone requis' });
      }

      const existingPatient = await prisma.patient.findFirst({
        where: { OR: [{ email }, { phone }] },
      });
      if (existingPatient) {
        return res.status(409).json({ error: 'Un compte patient existe déjà avec cet email ou ce téléphone' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      const patient = await prisma.patient.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          password: hashedPassword,
          dob: birthDate ? new Date(birthDate) : new Date('1970-01-01'),
          consentGdpr: true,
        },
      });

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

      return res.status(201).json({
        token,
        user: {
          id: patient.id,
          email: patient.email,
          name: `${patient.firstName} ${patient.lastName}`,
          role: 'PATIENT',
          phone: patient.phone,
          insurance: patient.insurance,
        },
      });
    }

    // --- Inscription Staff (Médecin / Secrétaire / Admin) ---
    // Note: le code d'invitation a été retiré ; n'importe qui peut créer un compte staff
    // en choisissant son rôle. À sécuriser plus tard si besoin (ex: validation par un admin).
    const dbRole = ROLE_MAP[role];
    if (!dbRole) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: `${firstName} ${lastName}`,
        role: dbRole,
      },
    });

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        specialty: newUser.specialty,
      },
    });
  } catch (error: any) {
    console.error("Erreur d'inscription:", error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    if (req.user.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          insurance: true,
          createdAt: true,
        },
      });

      if (!patient) {
        return res.status(404).json({ error: 'Patient non trouvé' });
      }

      return res.json({
        user: {
          id: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
          email: patient.email,
          phone: patient.phone,
          role: 'PATIENT',
          insurance: patient.insurance,
        }
      });
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