import prisma from '../config/db';
import stripeClient from '../config/stripe';

interface CreateIntentParams {
  patientId: number;
  appointmentId?: number;
  amount: number;          // ex: 25.00 (en unité principale, pas en centimes)
  currency?: string;       // défaut 'EUR'
  type?: 'PAYMENT' | 'DEPOSIT';
  notes?: string;
}

// ─── Créer un PaymentIntent Stripe + enregistrement local en attente ───────
// Couvre à la fois "Carte bancaire" et "Stripe" : les deux passent par Stripe côté processeur,
// on garde method = 'STRIPE' pour la transaction et on note le canal dans `notes` si besoin.
export async function createStripePaymentIntent(params: CreateIntentParams) {
  const { patientId, appointmentId, amount, currency = 'EUR', type = 'PAYMENT', notes } = params;

  if (!amount || amount <= 0) {
    throw new Error('Montant invalide');
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient introuvable');

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new Error('Rendez-vous introuvable');
  }

  // Stripe attend le montant en plus petite unité (centimes pour EUR/USD)
  const amountInCents = Math.round(amount * 100);

  const intent = await stripeClient.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    metadata: {
      patientId: patientId.toString(),
      appointmentId: appointmentId ? appointmentId.toString() : '',
      type,
    },
    description: type === 'DEPOSIT' ? 'Acompte - Cabinet médical' : 'Consultation - Cabinet médical',
    automatic_payment_methods: { enabled: true },
  });

  const payment = await prisma.payment.create({
    data: {
      patientId,
      appointmentId: appointmentId ?? null,
      amount,
      currency,
      method: 'STRIPE',
      status: 'PENDING',
      type,
      externalId: intent.id,
      externalStatus: intent.status,
      notes: notes ?? null,
    },
  });

  return {
    payment,
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

// ─── Synchroniser le statut local depuis un PaymentIntent Stripe ───────────
export async function syncStripePaymentStatus(paymentIntentId: string) {
  const existing = await prisma.payment.findFirst({ where: { externalId: paymentIntentId, method: 'STRIPE' } });
  if (!existing) {
    throw new Error("Aucun paiement local ne correspond à ce PaymentIntent Stripe");
  }

  const intent = await stripeClient.paymentIntents.retrieve(paymentIntentId);

  let newStatus = existing.status;
  if (intent.status === 'succeeded') newStatus = 'COMPLETED';
  else if (intent.status === 'canceled' || intent.status === 'requires_payment_method') newStatus = 'FAILED';
  else newStatus = 'PENDING';

  const payment = await prisma.payment.update({
    where: { id: existing.id },
    data: { status: newStatus, externalStatus: intent.status },
  });

  return { payment, stripeStatus: intent.status };
}

// ─── Traiter un événement webhook Stripe (payment_intent.succeeded / .payment_failed) ──
export async function handleStripeWebhookEvent(event: any) {
  const intent = event.data?.object;
  if (!intent?.id) return null;

  const existing = await prisma.payment.findFirst({ where: { externalId: intent.id, method: 'STRIPE' } });
  if (!existing) return null; // Événement non lié à un paiement suivi localement

  let newStatus = existing.status;
  if (event.type === 'payment_intent.succeeded') newStatus = 'COMPLETED';
  else if (event.type === 'payment_intent.payment_failed') newStatus = 'FAILED';
  else return existing; // Événement non pertinent pour le statut local

  return prisma.payment.update({
    where: { id: existing.id },
    data: { status: newStatus, externalStatus: intent.status },
  });
}

// ─── Rembourser un paiement Stripe complété ────────────────────────────────
export async function refundStripePayment(paymentId: number, amount?: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.method !== 'STRIPE' || !payment.externalId) {
    throw new Error('Paiement Stripe introuvable');
  }
  if (payment.status !== 'COMPLETED') {
    throw new Error('Seul un paiement complété peut être remboursé');
  }

  const refund = await stripeClient.refunds.create({
    payment_intent: payment.externalId,
    amount: amount ? Math.round(amount * 100) : undefined,
  });

  const isFull = !amount || Number(amount) >= Number(payment.amount);

  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      externalStatus: refund.status ?? undefined,
    },
  });
}
