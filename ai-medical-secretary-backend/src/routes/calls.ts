import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { hashForIndex } from '../utils/encryption';
const router = Router();

// GET /api/v1/calls (Admin, Secretary, Doctor only)
// Query filters: classification, direction, patientId
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { classification, direction, patientId } = req.query;

    const whereClause: any = {};
    if (classification) {
      whereClause.classification = classification as string;
    }
    if (direction) {
      whereClause.direction = direction as string;
    }
    if (patientId) {
      whereClause.patientId = parseInt(patientId as string);
    }

    const calls = await prisma.callLog.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return res.json({ calls });
  } catch (error: any) {
    console.error('Erreur GET /calls:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/calls/stats (Admin, Secretary, Doctor only)
// Computes metrics specified in CDC section 4.13
router.get('/stats', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Total number of calls
    const totalCalls = await prisma.callLog.count();

    // 2. Missed calls
    const missedCalls = await prisma.callLog.count({
      where: { status: 'MISSED' },
    });

    // 3. Average duration of calls (in seconds)
    const callsWithDuration = await prisma.callLog.aggregate({
      _avg: {
        duration: true,
      },
      where: {
        status: 'COMPLETED',
        duration: { not: null },
      },
    });
    const avgDuration = Math.round(callsWithDuration._avg.duration || 0);

    // 4. Appointments taken (total count of appointments, or appointments booked by AI calls)
    const apptsCount = await prisma.appointment.count();

    // 5. Cancellation rate
    const cancelledAppts = await prisma.appointment.count({
      where: { status: 'CANCELLED' },
    });
    const totalAppts = await prisma.appointment.count();
    const cancellationRate = totalAppts > 0 ? parseFloat(((cancelledAppts / totalAppts) * 100).toFixed(1)) : 0;

    // 6. Time saved (e.g. 2.5 minutes per handled call)
    const completedCallsCount = await prisma.callLog.count({
      where: { status: 'COMPLETED' },
    });
    const timeSavedMinutes = completedCallsCount * 2.5;

    // 7. Patient satisfaction mock score (e.g., 4.7 / 5.0)
    const patientSatisfaction = 4.8;

    return res.json({
      stats: {
        totalCalls,
        missedCalls,
        averageDurationSeconds: avgDuration,
        appointmentsTaken: apptsCount,
        cancellationRatePercent: cancellationRate,
        timeSavedMinutes,
        patientSatisfactionScore: patientSatisfaction,
      },
    });
  } catch (error: any) {
    console.error('Erreur GET /calls/stats:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PATCH /api/v1/calls/:id (Admin, Secretary only)
// Permet de corriger le résumé/la classification d'un appel (supervision humaine
// des réponses de l'IA), et/ou de marquer une urgence comme traitée.
router.patch('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant d\'appel invalide' });
    }

    const { summary, classification, emergencyHandled } = req.body;

    const existing = await prisma.callLog.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Appel introuvable' });
    }

    const data: any = {};
    if (summary !== undefined) data.summary = summary;
    if (classification !== undefined) data.classification = classification;
    if (emergencyHandled !== undefined) data.emergencyHandled = Boolean(emergencyHandled);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    const updated = await prisma.callLog.update({
      where: { id },
      data,
      include: {
        patient: {
          select: { firstName: true, lastName: true, phone: true },
        },
      },
    });

    return res.json({ message: 'Appel mis à jour avec succès', callLog: updated });
  } catch (error: any) {
    console.error('Erreur PATCH /calls/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/calls (Can be logged by the telephony / AI connector system)
router.post('/', async (req, res) => {
  try {
    const { direction, phoneNumber, status, duration, transcript, summary, classification, language, patientId } = req.body;

    if (!direction || !phoneNumber || !status) {
      return res.status(400).json({ error: 'La direction, le numéro de téléphone et le statut de l\'appel sont requis' });
    }

    // Try to auto-link to a patient by phone number if patientId not supplied
    // NB: le champ indexé est phoneHash (le numéro brut est chiffré, jamais
    // stocké/interrogé en clair) — voir utils/encryption.ts.
    let resolvedPatientId = patientId ? parseInt(patientId) : null;
    if (!resolvedPatientId) {
      const patient = await prisma.patient.findUnique({
        where: { phoneHash: hashForIndex(phoneNumber) },
      });
      if (patient) {
        resolvedPatientId = patient.id;
      }
    }

    const log = await prisma.callLog.create({
      data: {
        direction,
        phoneNumber,
        status,
        duration: duration ? parseInt(duration) : null,
        transcript,
        summary,
        classification,
        language: language || 'Français',
        patientId: resolvedPatientId,
      },
    });

    return res.status(201).json({ message: 'Journal d\'appel créé avec succès', callLog: log });
  } catch (error: any) {
    console.error('Erreur POST /calls:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;