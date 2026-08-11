import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ─── Message channels & statuses ─────────────────────────────────────────
const CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL', 'CHAT', 'MESSENGER'];
const MSG_STATUSES = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
const MSG_TYPES = ['AUTO_REPLY', 'REMINDER', 'NOTIFICATION', 'DOCUMENT', 'MANUAL'];

// ─── GET /api/v1/messaging ─── list messages ─────────────────────────────
router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { patientId, channel, status, type, page = '1', limit = '30' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = {};
      if (patientId) where.patientId = parseInt(patientId as string);
      if (channel)   where.channel   = channel;
      if (status)    where.status    = status;
      if (type)      where.type      = type;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where,
          skip,
          take: parseInt(limit as string),
          orderBy: { createdAt: 'desc' },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          },
        }),
        prisma.message.count({ where }),
      ]);

      return res.json({ messages, total, page: parseInt(page as string), limit: parseInt(limit as string) });
    } catch (error: any) {
      console.error('Erreur GET /messaging:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── POST /api/v1/messaging/send ─── send a message ─────────────────────
router.post('/send', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY', 'DOCTOR']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { patientId, channel, content, type = 'MANUAL', attachmentUrl, appointmentId } = req.body;

      if (!patientId || !channel || !content) {
        return res.status(400).json({ error: 'patientId, channel et content sont requis' });
      }
      if (!CHANNELS.includes(channel)) {
        return res.status(400).json({ error: `Canal invalide. Valeurs: ${CHANNELS.join(', ')}` });
      }

      const patient = await prisma.patient.findUnique({ where: { id: parseInt(patientId) } });
      if (!patient) return res.status(404).json({ error: 'Patient non trouvé' });

      // Simulate sending (in real app: call Twilio/SendGrid/etc.)
      const simulatedStatus = Math.random() > 0.05 ? 'SENT' : 'FAILED';

      const message = await prisma.message.create({
        data: {
          patientId:     parseInt(patientId),
          channel,
          content,
          type,
          status:        simulatedStatus,
          attachmentUrl: attachmentUrl || null,
          appointmentId: appointmentId ? parseInt(appointmentId) : null,
          sentAt:        simulatedStatus === 'SENT' ? new Date() : null,
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        },
      });

      return res.status(201).json({
        message: simulatedStatus === 'SENT' ? 'Message envoyé avec succès' : 'Échec de l\'envoi',
        data: message,
        simulated: true,
      });
    } catch (error: any) {
      console.error('Erreur POST /messaging/send:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── POST /api/v1/messaging/bulk ─── bulk reminders ─────────────────────
router.post('/bulk', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { channel, type = 'REMINDER', hoursAhead = 24 } = req.body;

      if (!channel || !CHANNELS.includes(channel)) {
        return res.status(400).json({ error: `Canal requis: ${CHANNELS.join(', ')}` });
      }

      // Find upcoming appointments in the next hoursAhead hours
      const now = new Date();
      const cutoff = new Date(now.getTime() + hoursAhead * 3600 * 1000);

      const upcoming = await prisma.appointment.findMany({
        where: {
          startTime: { gte: now, lte: cutoff },
          status: { not: 'CANCELLED' },
        },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
          doctor:  { select: { name: true, specialty: true } },
        },
      });

      const results = await Promise.all(upcoming.map(async (appt) => {
        const date = new Date(appt.startTime);
        const content = `Rappel : Votre rendez-vous avec ${appt.doctor.name} est prévu le ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Répondez ANNULER pour annuler.`;

        return prisma.message.create({
          data: {
            patientId:     appt.patientId,
            channel,
            content,
            type,
            status:        'SENT',
            appointmentId: appt.id,
            sentAt:        new Date(),
          },
        });
      }));

      return res.json({
        message: `${results.length} rappel(s) envoyé(s) via ${channel}`,
        count: results.length,
        simulated: true,
      });
    } catch (error: any) {
      console.error('Erreur POST /messaging/bulk:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── GET /api/v1/messaging/stats ─── channel stats ───────────────────────
router.get('/stats', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const total      = await prisma.message.count();
      const sent       = await prisma.message.count({ where: { status: 'SENT'      } });
      const failed     = await prisma.message.count({ where: { status: 'FAILED'    } });
      const delivered  = await prisma.message.count({ where: { status: 'DELIVERED' } });

      // Group by channel
      const byChannel: Record<string, number> = {};
      for (const ch of CHANNELS) {
        byChannel[ch] = await prisma.message.count({ where: { channel: ch } });
      }

      // Group by type
      const byType: Record<string, number> = {};
      for (const t of MSG_TYPES) {
        byType[t] = await prisma.message.count({ where: { type: t } });
      }

      return res.json({ total, sent, failed, delivered, byChannel, byType });
    } catch (error: any) {
      console.error('Erreur GET /messaging/stats:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

// ─── PATCH /api/v1/messaging/:id/status ─────────────────────────────────
router.patch('/:id/status', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      if (!MSG_STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

      const updated = await prisma.message.update({
        where: { id },
        data:  { status },
      });
      return res.json({ message: 'Statut mis à jour', data: updated });
    } catch (error: any) {
      console.error('Erreur PATCH /messaging/:id/status:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  }
);

export default router;
