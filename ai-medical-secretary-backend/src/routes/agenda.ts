import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/v1/agenda/availability?doctorId=&date=YYYY-MM-DD&slotDuration=30
 * Returns free slots for a doctor on a given day.
 */
router.get('/availability', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, date, slotDuration } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ error: 'doctorId et date sont requis' });
    }

    const dId = parseInt(doctorId as string);
    const targetDate = new Date(date as string);
    const duration = parseInt((slotDuration as string) || '30'); // minutes

    if (isNaN(dId) || isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'doctorId ou date invalide' });
    }

    const dayOfWeek = targetDate.getDay();
    const dateOnly = targetDate.toISOString().split('T')[0];

    // Check if doctor is on leave this day
    const leave = await prisma.leave.findFirst({
      where: {
        doctorId: dId,
        startDate: { lte: new Date(dateOnly + 'T23:59:59') },
        endDate: { gte: new Date(dateOnly + 'T00:00:00') },
      },
    });
    if (leave) {
      return res.json({ available: false, reason: 'Congé', slots: [] });
    }

    // Check if day is a public holiday
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: new Date(dateOnly + 'T00:00:00'),
          lte: new Date(dateOnly + 'T23:59:59'),
        },
      },
    });
    if (holiday) {
      return res.json({ available: false, reason: `Jour férié: ${holiday.name}`, slots: [] });
    }

    // Get special hours for the day (override regular schedule)
    const specialHour = await prisma.specialHour.findFirst({
      where: {
        doctorId: dId,
        date: {
          gte: new Date(dateOnly + 'T00:00:00'),
          lte: new Date(dateOnly + 'T23:59:59'),
        },
      },
    });

    // Get regular availability for the day of week
    const regularAvail = await prisma.doctorAvailability.findFirst({
      where: { doctorId: dId, dayOfWeek, isAvailable: true },
    });

    const schedule = specialHour
      ? { startTime: specialHour.startTime, endTime: specialHour.endTime, isAvailable: specialHour.isAvailable }
      : regularAvail
      ? { startTime: regularAvail.startTime, endTime: regularAvail.endTime, isAvailable: true }
      : null;

    if (!schedule || !schedule.isAvailable) {
      return res.json({ available: false, reason: 'Médecin non disponible ce jour', slots: [] });
    }

    // Build all theoretical slots
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const allSlots: { start: string; end: string }[] = [];
    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const sh = String(Math.floor(m / 60)).padStart(2, '0');
      const sm = String(m % 60).padStart(2, '0');
      const eh = String(Math.floor((m + duration) / 60)).padStart(2, '0');
      const em = String((m + duration) % 60).padStart(2, '0');
      allSlots.push({ start: `${sh}:${sm}`, end: `${eh}:${em}` });
    }

    // Get existing appointments on that day
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: dId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startTime: { gte: new Date(dateOnly + 'T00:00:00') },
        endTime: { lte: new Date(dateOnly + 'T23:59:59') },
      },
    });

    // Filter out occupied slots
    const freeSlots = allSlots.filter(slot => {
      const slotStart = parseInt(slot.start.replace(':', ''));
      const slotEnd = parseInt(slot.end.replace(':', ''));
      return !existingAppointments.some(appt => {
        const apptStart = appt.startTime.getHours() * 100 + appt.startTime.getMinutes();
        const apptEnd = appt.endTime.getHours() * 100 + appt.endTime.getMinutes();
        return slotStart < apptEnd && slotEnd > apptStart; // overlapping
      });
    });

    return res.json({ available: true, date: dateOnly, slots: freeSlots, totalFree: freeSlots.length });
  } catch (error: any) {
    console.error('Erreur GET /agenda/availability:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Cabinets ────────────────────────────────────────────────────────────────

// GET /api/v1/agenda/cabinets
router.get('/cabinets', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (_req, res: Response) => {
  try {
    const cabinets = await prisma.cabinet.findMany({ include: { rooms: true } });
    return res.json({ cabinets });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/agenda/cabinets
router.post('/cabinets', authenticateJWT as any, requireRole(['ADMIN']) as any, async (req, res: Response) => {
  try {
    const { name, address, phone } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'name et address sont requis' });
    const cabinet = await prisma.cabinet.create({ data: { name, address, phone } });
    return res.status(201).json({ cabinet });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Leaves (Congés) ─────────────────────────────────────────────────────────

// GET /api/v1/agenda/leaves?doctorId=
router.get('/leaves', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId } = req.query;
    const where = doctorId ? { doctorId: parseInt(doctorId as string) } : {};
    const leaves = await prisma.leave.findMany({ where, orderBy: { startDate: 'asc' } });
    return res.json({ leaves });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/agenda/leaves
router.post('/leaves', authenticateJWT as any, requireRole(['ADMIN', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, startDate, endDate, reason } = req.body;
    if (!doctorId || !startDate || !endDate) return res.status(400).json({ error: 'doctorId, startDate et endDate sont requis' });

    const leave = await prisma.leave.create({
      data: { doctorId, startDate: new Date(startDate), endDate: new Date(endDate), reason },
    });
    return res.status(201).json({ leave });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// DELETE /api/v1/agenda/leaves/:id
router.delete('/leaves/:id', authenticateJWT as any, requireRole(['ADMIN', 'DOCTOR']) as any, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.leave.delete({ where: { id } });
    return res.json({ message: 'Congé supprimé' });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Special Hours ────────────────────────────────────────────────────────────

// POST /api/v1/agenda/special-hours
router.post('/special-hours', authenticateJWT as any, requireRole(['ADMIN', 'DOCTOR']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, date, startTime, endTime, isAvailable } = req.body;
    if (!doctorId || !date || !startTime || !endTime) return res.status(400).json({ error: 'Champs requis manquants' });

    const specialHour = await prisma.specialHour.create({
      data: { doctorId, date: new Date(date), startTime, endTime, isAvailable: isAvailable !== false },
    });
    return res.status(201).json({ specialHour });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── Holidays ────────────────────────────────────────────────────────────────

// GET /api/v1/agenda/holidays
router.get('/holidays', authenticateJWT as any, async (_req, res: Response) => {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
    return res.json({ holidays });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/agenda/holidays
router.post('/holidays', authenticateJWT as any, requireRole(['ADMIN']) as any, async (req, res: Response) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'date et name sont requis' });
    const holiday = await prisma.holiday.upsert({
      where: { date: new Date(date) },
      update: { name },
      create: { date: new Date(date), name },
    });
    return res.status(201).json({ holiday });
  } catch (e: any) {
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
