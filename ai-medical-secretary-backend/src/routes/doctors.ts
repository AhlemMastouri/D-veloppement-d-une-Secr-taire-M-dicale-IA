import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/doctors
// Returns all users with role DOCTOR — accessible to authenticated users (including patients)
router.get('/', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: {
        id: true,
        name: true,
        email: true,
        specialty: true,
        availabilities: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            specificDate: true,
            isAvailable: true,
          },
          where: { isAvailable: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({ doctors });
  } catch (error: any) {
    console.error('Erreur GET /doctors:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/doctors/:id/slots?date=YYYY-MM-DD
// Returns available time slots for a doctor on a specific date
router.get('/:id/slots', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { date } = req.query;

    if (isNaN(doctorId)) {
      return res.status(400).json({ error: 'ID médecin invalide' });
    }

    const doctor = await prisma.user.findUnique({
      where: { id: doctorId, role: 'DOCTOR' },
      include: {
        availabilities: {
          where: { isAvailable: true },
        },
      },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Paramètre date requis (YYYY-MM-DD)' });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0=Sun...6=Sat

    // Find availabilities for this day
    const dayAvailabilities = doctor.availabilities.filter(
      (a) => a.dayOfWeek === dayOfWeek || 
              (a.specificDate && new Date(a.specificDate).toDateString() === targetDate.toDateString())
    );

    // Generate 30-min slots
    const slots: string[] = [];
    for (const avail of dayAvailabilities) {
      const [startH, startM] = avail.startTime.split(':').map(Number);
      const [endH, endM] = avail.endTime.split(':').map(Number);
      let cursor = startH * 60 + startM;
      const end = endH * 60 + endM;
      while (cursor + 30 <= end) {
        const hh = String(Math.floor(cursor / 60)).padStart(2, '0');
        const mm = String(cursor % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
        cursor += 30;
      }
    }

    // Filter out already booked slots
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true },
    });

    const bookedTimes = bookedAppointments.map((a) => {
      const d = new Date(a.startTime);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const availableSlots = slots.filter((s) => !bookedTimes.includes(s));

    return res.json({ 
      doctorId,
      date,
      slots: availableSlots,
      bookedSlots: bookedTimes
    });
  } catch (error: any) {
    console.error('Erreur GET /doctors/:id/slots:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
