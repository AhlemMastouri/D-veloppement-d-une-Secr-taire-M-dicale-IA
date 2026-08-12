import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { upsertGoogleEvent, deleteGoogleEvent } from '../services/googleCalendarService';
import { upsertOutlookEvent, deleteOutlookEvent } from '../services/outlookCalendarService';
import { decrypt } from '../utils/encryption';

const router = Router();

// GET /api/v1/appointments (Admin, Secretary, Doctor only)
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR', 'PATIENT']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, patientId, status, startDate, endDate } = req.query;

    const whereClause: any = {};

    // If the caller is a patient, restrict to their own records
    if (req.user?.role === 'PATIENT') {
      whereClause.patientId = req.user.id;
    } else {
      if (doctorId) whereClause.doctorId = parseInt(doctorId as string);
      if (patientId) whereClause.patientId = parseInt(patientId as string);
    }
    if (status) whereClause.status = status as string;

    if (startDate || endDate) {
      whereClause.startTime = {};
      if (startDate) whereClause.startTime.gte = new Date(startDate as string);
      if (endDate) whereClause.startTime.lte = new Date(endDate as string);
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

// POST /api/v1/appointments
router.post('/', async (req, res) => {
  try {
    const { patientId, doctorId, startTime, duration = 30, notes } = req.body;

    if (!patientId || !doctorId || !startTime) {
      return res.status(400).json({ error: 'Le patientId, doctorId et startTime sont requis' });
    }

    const patientIdNum = parseInt(patientId);
    const doctorIdNum = parseInt(doctorId);
    const durationNum = parseInt(duration);

    if (isNaN(patientIdNum) || isNaN(doctorIdNum) || isNaN(durationNum)) {
      return res.status(400).json({ error: 'patientId, doctorId et duration doivent être numériques' });
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'startTime invalide' });
    }
    const end = new Date(start.getTime() + durationNum * 60 * 1000);

    const patient = await prisma.patient.findUnique({ where: { id: patientIdNum } });
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    const doctor = await prisma.user.findFirst({ where: { id: doctorIdNum, role: 'DOCTOR' } });
    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // Vérification double-réservation
    const overlapping = await prisma.appointment.findFirst({
      where: {
        doctorId: doctorIdNum,
        status: { in: ['CONFIRMED', 'PENDING'] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
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

    // Transaction: RDV + notification sont stockés ensemble, ou aucun des deux
    // (évite les enregistrements orphelins si la notification échoue)
    const appointment = await prisma.$transaction(async (tx) => {
      const created = await tx.appointment.create({
        data: {
          patientId: patientIdNum,
          doctorId: doctorIdNum,
          startTime: start,
          endTime: end,
          status: 'CONFIRMED',
          notes,
        },
        include: {
          doctor: { select: { name: true } },
          patient: { select: { firstName: true, lastName: true, phone: true } },
        },
      });

      await tx.notification.create({
        data: {
          appointmentId: created.id,
          patientId: created.patientId,
          type: 'SMS',
          status: 'SENT',
          messageContent: `Confirmation: Votre RDV avec ${created.doctor.name} est confirmé pour le ${start.toLocaleString('fr-FR')}.`,
          sentAt: new Date(),
        },
      });

      return created;
    });

    // Sync with external calendars (non-blocking)
    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
    const patientPhone = appointment.patient.phone ? decrypt(appointment.patient.phone) : '';
    const summary = `RDV – ${patientName} (${patientPhone})`;
    const description = notes || 'Rendez-vous médical';
    upsertGoogleEvent({
      summary,
      description,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }).catch(e => console.error('[GoogleCalendar] Sync failed:', e.message));
    upsertOutlookEvent({
      subject: summary,
      body: description,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
    }).catch(e => console.error('[Outlook] Sync failed:', e.message));

    return res.status(201).json({ message: 'Rendez-vous réservé avec succès', appointment });
  } catch (error: any) {
    console.error('Erreur POST /appointments:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PATCH /api/v1/appointments/:id
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de rendez-vous invalide' });
    }

    const { startTime, duration = 30, status, notes } = req.body;
    const durationNum = parseInt(duration);
    if (isNaN(durationNum)) {
      return res.status(400).json({ error: 'duration invalide' });
    }

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
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'startTime invalide' });
      }
      end = new Date(start.getTime() + durationNum * 60 * 1000);

      const overlapping = await prisma.appointment.findFirst({
        where: {
          id: { not: id },
          doctorId: appointmentExists.doctorId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
        },
      });

      if (overlapping) {
        return res.status(409).json({ error: 'Ce créneau est déjà réservé pour ce médecin' });
      }
    }

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          startTime: startTime ? start : undefined,
          endTime: startTime ? end : undefined,
          status: status !== undefined ? status : undefined,
          notes: notes !== undefined ? notes : undefined,
        },
      });

      if (status === 'CANCELLED') {
        await tx.notification.create({
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
        await tx.notification.create({
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

      return updated;
    });

    return res.json({ message: 'Rendez-vous mis à jour avec succès', appointment: updatedAppointment });
  } catch (error: any) {
    console.error('Erreur PATCH /appointments/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/appointments/:id/confirm
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

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.appointment.update({ where: { id }, data: { status: 'CONFIRMED' } });

      await tx.notification.create({
        data: {
          appointmentId: id,
          patientId: appointment.patientId,
          type: 'SMS',
          status: 'SENT',
          messageContent: `Validation: Votre RDV en attente avec ${appointment.doctor.name} le ${appointment.startTime.toLocaleString('fr-FR')} est validé.`,
          sentAt: new Date(),
        },
      });

      return u;
    });

    return res.json({ message: 'Rendez-vous validé avec succès', appointment: updated });
  } catch (error: any) {
    console.error('Erreur POST /appointments/:id/confirm:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/appointments/:id/cancel
router.post('/:id/cancel', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR', 'PATIENT']) as any, async (req: AuthenticatedRequest, res: Response) => {
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

    // Patients can only cancel their own appointments
    if (req.user?.role === 'PATIENT' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Accès interdit: vous ne pouvez annuler que vos propres rendez-vous' });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(409).json({ error: 'Ce rendez-vous est déjà annulé' });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const u = await tx.appointment.update({ where: { id }, data: { status: 'CANCELLED' } });

      await tx.notification.create({
        data: {
          appointmentId: id,
          patientId: appointment.patientId,
          type: 'SMS',
          status: 'SENT',
          messageContent: `Annulation: Votre RDV avec ${appointment.doctor.name} le ${appointment.startTime.toLocaleString('fr-FR')} a été annulé.`,
          sentAt: new Date(),
        },
      });

      return u;
    });

    return res.json({ message: 'Rendez-vous annulé avec succès', appointment: updated });
  } catch (error: any) {
    console.error('Erreur POST /appointments/:id/cancel:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;