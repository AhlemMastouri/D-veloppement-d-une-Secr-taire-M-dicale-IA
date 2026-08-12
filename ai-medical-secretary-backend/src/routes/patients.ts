import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { encrypt, decrypt, hashForIndex } from '../utils/encryption';

const router = Router();

/** Helper: decrypt sensitive fields of a patient record before sending to client */
function decryptPatient(p: any) {
  if (!p) return p;
  return {
    ...p,
    phone: p.phone ? decrypt(p.phone) : p.phone,
    email: p.email ? decrypt(p.email) : p.email,
    insurance: p.insurance ? decrypt(p.insurance) : p.insurance,
    phoneHash: undefined, // never expose the hash
  };
}

// GET /api/v1/patients
// Query params: search (searches lastName, firstName, or by phone via hash)
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search } = req.query;

    let whereClause: any = {};
    if (search && typeof search === 'string') {
      // Try exact phone hash lookup first, then fall back to name search
      const phoneHash = hashForIndex(search);
      whereClause = {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { phoneHash }, // exact deterministic match for phone search
        ],
      };
    }

    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { lastName: 'asc' },
    });

    return res.json({ patients: patients.map(decryptPatient) });
  } catch (error: any) {
    console.error('Erreur GET /patients:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/patients/:id
router.get('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID de patient invalide' });

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          include: { doctor: { select: { name: true, specialty: true } } },
        },
        callLogs: { orderBy: { startTime: 'desc' } },
        dictations: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) return res.status(404).json({ error: 'Patient non trouvé' });

    return res.json({ patient: decryptPatient(patient) });
  } catch (error: any) {
    console.error('Erreur GET /patients/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/patients — auto-creates patient on first appointment (or manually by secretary)
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;

    if (!firstName || !lastName || !dob || !phone) {
      return res.status(400).json({ error: 'Le prénom, nom, date de naissance et téléphone sont requis' });
    }

    // Deterministic hash for unique phone lookup
    const phoneHash = hashForIndex(phone);

    const existingPatient = await prisma.patient.findUnique({ where: { phoneHash } });
    if (existingPatient) {
      return res.status(409).json({
        error: 'Un patient avec ce numéro de téléphone existe déjà',
        patient: decryptPatient(existingPatient),
      });
    }

    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        dob: new Date(dob),
        phone: encrypt(phone),
        phoneHash,
        email: email ? encrypt(email) : undefined,
        insurance: insurance ? encrypt(insurance) : undefined,
        treatingPhysician,
        consentGdpr: !!consentGdpr,
      },
    });

    return res.status(201).json({ message: 'Patient créé avec succès', patient: decryptPatient(patient) });
  } catch (error: any) {
    console.error('Erreur POST /patients:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/v1/patients/:id
router.put('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID de patient invalide' });

    const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;

    const patientExists = await prisma.patient.findUnique({ where: { id } });
    if (!patientExists) return res.status(404).json({ error: 'Patient non trouvé' });

    // If phone is changing, ensure no duplicate exists
    let phoneHash: string | undefined;
    if (phone) {
      phoneHash = hashForIndex(phone);
      if (phoneHash !== patientExists.phoneHash) {
        const conflict = await prisma.patient.findUnique({ where: { phoneHash } });
        if (conflict) return res.status(409).json({ error: 'Un autre patient possède déjà ce numéro de téléphone' });
      }
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        dob: dob ? new Date(dob) : undefined,
        phone: phone ? encrypt(phone) : undefined,
        phoneHash: phoneHash ?? undefined,
        email: email !== undefined ? (email ? encrypt(email) : null) : undefined,
        insurance: insurance !== undefined ? (insurance ? encrypt(insurance) : null) : undefined,
        treatingPhysician: treatingPhysician ?? undefined,
        consentGdpr: consentGdpr !== undefined ? !!consentGdpr : undefined,
      },
    });

    return res.json({ message: 'Patient mis à jour avec succès', patient: decryptPatient(updatedPatient) });
  } catch (error: any) {
    console.error('Erreur PUT /patients/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/patients/:id/history — Full appointment history with archiving
router.get('/:id/history', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID de patient invalide' });

    const [appointments, archived] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId: id },
        orderBy: { startTime: 'desc' },
        include: { doctor: { select: { name: true, specialty: true } }, room: true, cabinet: true },
      }),
      prisma.archivedAppointment.findMany({
        where: { patientId: id },
        orderBy: { startTime: 'desc' },
      }),
    ]);

    return res.json({ active: appointments, archived });
  } catch (error: any) {
    console.error('Erreur GET /patients/:id/history:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
