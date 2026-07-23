import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/appointments (Admin, Secretary, Doctor only)
// Query filters: doctorId, patientId, status, startDate, endDate
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, patientId, status, startDate, endDate } = req.query;

    const whereClause: any = {};

    if (doctorId) {
      whereClause.doctorId = parseInt(doctorId as string);
    }
    if (patientId) {
      whereClause.patientId = parseInt(patientId as string);
    }
    if (status) {
      whereClause.status = status as string;
    }

    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) {
        whereClause.startTime.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.startTime.lte = new Date(endDate as string);
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return res.json({ appointments });
  } catch (error: any) {
    console.error('Erreur GET /appointments:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/appointments (Can be booked by anyone/AI secretary)
// Payload: patientId, doctorId, startTime, duration (in minutes, defaults to 30), notes
router.post('/', async (req, res) => {
  try {
    const { patientId, doctorId, startTime, duration = 30, notes } = req.body;

    if (!patientId || !doctorId || !startTime) {
      return res.status(400).json({ error: 'Le patientId, doctorId et startTime sont requis' });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    // Verify patient and doctor exist
    const patient = await prisma.patient.findUnique({ where: { id: parseInt(patientId) } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    const doctor = await prisma.user.findFirst({
      where: { id: parseInt(doctorId), role: 'DOCTOR' },
    });
    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // Check for double booking / overlapping appointments for this doctor
    const overlapping = await prisma.appointment.findFirst({
      where: {
        doctorId: parseInt(doctorId),
        status: { in: ['CONFIRMED', 'PENDING'] },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    });

    if (overlapping) {
      return res.status(409).json({
        error: 'Ce créneau est déjà réservé pour ce médecin',
        overlappingAppointment: {
          id: overlapping.id,
          startTime: overlapping.startTime,
          endTime: overlapping.endTime,
        },
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: parseInt(patientId),
        doctorId: parseInt(doctorId),
        startTime: start,
        endTime: end,
        status: 'CONFIRMED', // Default to confirmed. Can change to PENDING if approval required.
        notes,
      },
      include: {
        doctor: { select: { name: true } },
        patient: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    // Create automatic confirmation notification
    await prisma.notification.create({
      data: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        type: 'SMS',
        status: 'SENT',
        messageContent: `Confirmation: Votre RDV avec ${appointment.doctor.name} est confirmé pour le ${start.toLocaleString('fr-FR')}.`,
        sentAt: new Date(),
      },
    });

    return res.status(201).json({ message: 'Rendez-vous réservé avec succès', appointment });
  } catch (error: any) {
    console.error('Erreur POST /appointments:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PATCH /api/v1/appointments/:id (Modify appointment - status, time, notes)
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de rendez-vous invalide' });
    }

    const { startTime, duration = 30, status, notes } = req.body;

    const appointmentExists = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: { select: { name: true } } },
    });

    if (!appointmentExists) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    let start = appointmentExists.startTime;
    let end = appointmentExists.endTime;

    if (startTime) {
      start = new Date(startTime);
      end = new Date(start.getTime() + duration * 60 * 1000);

      // Check for overlapping appointments, excluding the current appointment itself
      const overlapping = await prisma.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: appointmentExists.doctorId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          AND: [
            { startTime: { lt: end } },
            { endTime: { gt: start } },
          ],
        },
      });

      if (overlapping) {
        return res.status(409).json({ error: 'Ce créneau est déjà réservé pour ce médecin' });
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        startTime: startTime ? start : undefined,
        endTime: startTime ? end : undefined,
        status: status !== undefined ? status : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    // Create notification for modification/cancellation
    if (status === 'CANCELLED') {
      await prisma.notification.create({
        data: {
          appointmentId: id,
          patientId: appointmentExists.patientId,
          type: 'SMS',
          status: 'SENT',
          messageContent: `Annulation: Votre RDV avec ${appointmentExists.doctor.name} le ${appointmentExists.startTime.toLocaleString('fr-FR')} a été annulé.`,
          sentAt: new Date(),
        },
      });
    } else if (startTime) {
      await prisma.notification.create({
        data: {
          appointmentId: id,
          patientId: appointmentExists.patientId,
          type: 'SMS',
          status: 'SENT',
          messageContent: `Modification: Votre RDV avec ${appointmentExists.doctor.name} a été déplacé au ${start.toLocaleString('fr-FR')}.`,
          sentAt: new Date(),
        },
      });
    }

    return res.json({ message: 'Rendez-vous mis à jour avec succès', appointment: updatedAppointment });
  } catch (error: any) {
    console.error('Erreur PATCH /appointments/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/appointments/:id/confirm (Manually confirm pending appointment)
router.post('/:id/confirm', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de rendez-vous invalide' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: { select: { name: true } } },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    await prisma.notification.create({
      data: {
        appointmentId: id,
        patientId: appointment.patientId,
        type: 'SMS',
        status: 'SENT',
        messageContent: `Validation: Votre RDV en attente avec ${appointment.doctor.name} le ${appointment.startTime.toLocaleString('fr-FR')} est validé.`,
        sentAt: new Date(),
      },
    });

    return res.json({ message: 'Rendez-vous validé avec succès', appointment: updated });
  } catch (error: any) {
    console.error('Erreur POST /appointments/:id/confirm:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
