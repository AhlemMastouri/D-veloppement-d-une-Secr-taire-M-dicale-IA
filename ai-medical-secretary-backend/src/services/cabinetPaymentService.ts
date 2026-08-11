import prisma from '../config/db';

interface RecordCabinetPaymentParams {
  patientId: number;
  appointmentId?: number;
  amount: number;
  currency?: string;
  method: 'ESPECES' | 'CHEQUE' | 'VIREMENT';
  type?: 'PAYMENT' | 'DEPOSIT';
  confirmedBy: number; // id de l'utilisateur (secrétaire/admin) qui enregistre le paiement
  notes?: string;
}

// ─── Enregistrer un paiement au cabinet (espèces, chèque, virement) ────────
// Contrairement à PayPal/Stripe, il n'y a pas de processeur externe : le paiement est
// directement marqué COMPLETED car la secrétaire confirme la réception manuellement.
export async function recordCabinetPayment(params: RecordCabinetPaymentParams) {
  const { patientId, appointmentId, amount, currency = 'EUR', method, type = 'PAYMENT', confirmedBy, notes } = params;

  if (!['ESPECES', 'CHEQUE', 'VIREMENT'].includes(method)) {
    throw new Error('Méthode de paiement cabinet invalide');
  }
  if (!amount || amount <= 0) {
    throw new Error('Montant invalide');
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient introuvable');

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new Error('Rendez-vous introuvable');
  }

  return prisma.payment.create({
    data: {
      patientId,
      appointmentId: appointmentId ?? null,
      amount,
      currency,
      method,
      status: 'COMPLETED', // confirmation manuelle immédiate
      type,
      confirmedBy,
      notes: notes ?? null,
    },
  });
}

// ─── Rembourser un paiement cabinet (remise en main propre / geste commercial) ──
// Pas d'appel externe : mise à jour du statut local uniquement, à effectuer une fois
// le remboursement physique/administratif réalisé par le cabinet.
export async function refundCabinetPayment(paymentId: number, amount?: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || !['ESPECES', 'CHEQUE', 'VIREMENT'].includes(payment.method)) {
    throw new Error('Paiement cabinet introuvable');
  }
  if (payment.status !== 'COMPLETED') {
    throw new Error('Seul un paiement complété peut être remboursé');
  }

  const isFull = !amount || Number(amount) >= Number(payment.amount);

  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    },
  });
}
