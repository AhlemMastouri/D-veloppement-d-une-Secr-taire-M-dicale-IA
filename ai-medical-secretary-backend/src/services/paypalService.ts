import prisma from '../config/db';
import paypalClient, { paypal } from '../config/paypal';

// ─── Types ──────────────────────────────────────────────────────────────────
interface CreateOrderParams {
  patientId: number;
  appointmentId?: number;
  amount: number;          // ex: 25.00
  currency?: string;       // défaut 'EUR'
  type?: 'PAYMENT' | 'DEPOSIT';
  notes?: string;
}

interface CaptureResult {
  payment: Awaited<ReturnType<typeof prisma.payment.update>>;
  captureStatus: string;
}

// ─── Créer un ordre PayPal + enregistrement local en attente ───────────────
export async function createPaypalOrder(params: CreateOrderParams) {
  const { patientId, appointmentId, amount, currency = 'EUR', type = 'PAYMENT', notes } = params;

  if (!amount || amount <= 0) {
    throw new Error('Montant invalide');
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw new Error('Patient introuvable');
  }

  if (appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) {
      throw new Error('Rendez-vous introuvable');
    }
  }

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
        custom_id: patientId.toString(),
        description: type === 'DEPOSIT' ? 'Acompte - Cabinet médical' : 'Consultation - Cabinet médical',
      },
    ],
  });

  const order = await paypalClient.execute(request);
  const orderId = order.result.id;

  // Enregistrement local en attente, lié à l'ordre PayPal
  const payment = await prisma.payment.create({
    data: {
      patientId,
      appointmentId: appointmentId ?? null,
      amount,
      currency,
      method: 'PAYPAL',
      status: 'PENDING',
      type,
      externalId: orderId,
      externalStatus: order.result.status,
      notes: notes ?? null,
    },
  });

  // Lien d'approbation à renvoyer au frontend pour rediriger le patient
  const approveLink = order.result.links?.find((l: any) => l.rel === 'approve')?.href ?? null;

  return { payment, orderId, approveLink, paypalStatus: order.result.status };
}

// ─── Capturer un paiement PayPal après approbation du patient ──────────────
export async function capturePaypalOrder(orderId: string): Promise<CaptureResult> {
  const existing = await prisma.payment.findFirst({ where: { externalId: orderId, method: 'PAYPAL' } });
  if (!existing) {
    throw new Error("Aucun paiement local ne correspond à cet ordre PayPal");
  }

  const request = new paypal.orders.OrdersCaptureRequest(orderId);
  // @ts-ignore - requestBody() attend un objet vide pour la capture
  request.requestBody({});

  const capture = await paypalClient.execute(request);
  const captureStatus: string = capture.result.status; // ex: 'COMPLETED'

  const newStatus = captureStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED';

  const payment = await prisma.payment.update({
    where: { id: existing.id },
    data: {
      status: newStatus,
      externalStatus: captureStatus,
    },
  });

  return { payment, captureStatus };
}

// ─── Récupérer le statut actuel d'un ordre PayPal (sans capturer) ──────────
export async function getPaypalOrderStatus(orderId: string) {
  const request = new paypal.orders.OrdersGetRequest(orderId);
  const order = await paypalClient.execute(request);
  return order.result;
}

// ─── Rembourser une capture PayPal ─────────────────────────────────────────
export async function refundPaypalPayment(paymentId: number, amount?: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.method !== 'PAYPAL' || !payment.externalId) {
    throw new Error('Paiement PayPal introuvable');
  }
  if (payment.status !== 'COMPLETED') {
    throw new Error('Seul un paiement complété peut être remboursé');
  }

  // Récupérer l'id de capture depuis l'ordre PayPal
  const orderDetails = await getPaypalOrderStatus(payment.externalId);
  const captureId = orderDetails?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!captureId) {
    throw new Error("Impossible de retrouver l'identifiant de capture PayPal");
  }

  const request = new paypal.payments.CapturesRefundRequest(captureId);
  request.requestBody(
    amount
      ? { amount: { value: amount.toFixed(2), currency_code: payment.currency } }
      : {}
  );

  const refund = await paypalClient.execute(request);
  const isFull = !amount || Number(amount) >= Number(payment.amount);

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      externalStatus: refund.result.status,
    },
  });

  return updated;
}
