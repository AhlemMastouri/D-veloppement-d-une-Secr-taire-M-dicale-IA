import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/patients (Admin, Secretary, Doctor only)
// Query params: search (searches lastName, firstName, phone)
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search } = req.query;

    let whereClause = {};
    if (search && typeof search === 'string') {
      whereClause = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { phone: { contains: search } },
        ],
      };
    }

    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { lastName: 'asc' },
    });

    return res.json({ patients });
  } catch (error: any) {
    console.error('Erreur GET /patients:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/patients/:id (Admin, Secretary, Doctor only)
router.get('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de patient invalide' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          include: { doctor: { select: { name: true, specialty: true } } },
        },
        callLogs: {
          orderBy: { startTime: 'desc' },
        },
        dictations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    return res.json({ patient });
  } catch (error: any) {
    console.error('Erreur GET /patients/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/patients (Open or Authenticated - can be called by AI Secretary)
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;

    if (!firstName || !lastName || !dob || !phone) {
      return res.status(400).json({ error: 'Le prénom, nom, date de naissance et téléphone sont requis' });
    }

    // Check if patient with this phone already exists
    const existingPatient = await prisma.patient.findUnique({
      where: { phone },
    });

    if (existingPatient) {
      return res.status(409).json({ error: 'Un patient avec ce numéro de téléphone existe déjà', patient: existingPatient });
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        dob: new Date(dob),
        phone,
        email,
        insurance,
        treatingPhysician,
        consentGdpr: !!consentGdpr,
      },
    });

    return res.status(201).json({ message: 'Patient créé avec succès', patient });
  } catch (error: any) {
    console.error('Erreur POST /patients:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/v1/patients/:id (Admin, Secretary, Doctor only)
router.put('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de patient invalide' });
    }

    const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;

    // Check if patient exists
    const patientExists = await prisma.patient.findUnique({ where: { id } });
    if (!patientExists) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    // Check if phone number is being changed to another patient's phone
    if (phone && phone !== patientExists.phone) {
      const phoneConflict = await prisma.patient.findUnique({ where: { phone } });
      if (phoneConflict) {
        return res.status(409).json({ error: 'Un autre patient possède déjà ce numéro de téléphone' });
      }
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        dob: dob !== undefined ? new Date(dob) : undefined,
        phone: phone !== undefined ? phone : undefined,
        email: email !== undefined ? email : undefined,
        insurance: insurance !== undefined ? insurance : undefined,
        treatingPhysician: treatingPhysician !== undefined ? treatingPhysician : undefined,
        consentGdpr: consentGdpr !== undefined ? !!consentGdpr : undefined,
      },
    });

    return res.json({ message: 'Patient mis à jour avec succès', patient: updatedPatient });
  } catch (error: any) {
    console.error('Erreur PUT /patients/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
