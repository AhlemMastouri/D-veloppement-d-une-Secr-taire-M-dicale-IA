import { Router, Response, Request } from 'express';
import express from 'express';
import prisma from '../config/db';
import stripeClient, { STRIPE_WEBHOOK_SECRET } from '../config/stripe';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  createPaypalOrder,
  capturePaypalOrder,
  getPaypalOrderStatus,
  refundPaypalPayment,
} from '../services/paypalService';
import {
  createStripePaymentIntent,
  syncStripePaymentStatus,
  handleStripeWebhookEvent,
  refundStripePayment,
} from '../services/stripeService';
import {
  recordCabinetPayment,
  refundCabinetPayment,
} from '../services/cabinetPaymentService';
import { generateInvoicePdf } from '../services/invoiceService';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// PAYPAL
// ═══════════════════════════════════════════════════════════════════════════

router.post('/paypal/create-order', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, appointmentId, amount, currency, type, notes } = req.body;
    if (!patientId || !amount) return res.status(400).json({ error: 'patientId et amount sont requis' });

    const result = await createPaypalOrder({
      patientId: Number(patientId),
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      amount: Number(amount),
      currency, type, notes,
    });

    return res.status(201).json({
      message: 'Ordre PayPal créé',
      orderId: result.orderId,
      approveLink: result.approveLink,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('Erreur POST /payments/paypal/create-order:', error);
    return res.status(400).json({ error: error.message || "Erreur lors de la création de l'ordre PayPal" });
  }
});

router.post('/paypal/capture/:orderId', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { payment, captureStatus } = await capturePaypalOrder(orderId);
    return res.json({
      message: captureStatus === 'COMPLETED' ? 'Paiement capturé avec succès' : 'Échec de la capture du paiement',
      captureStatus, payment,
    });
  } catch (error: any) {
    console.error('Erreur POST /payments/paypal/capture/:orderId:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors de la capture du paiement' });
  }
});

router.get('/paypal/status/:orderId', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getPaypalOrderStatus(req.params.orderId);
    return res.json({ status });
  } catch (error: any) {
    console.error('Erreur GET /payments/paypal/status/:orderId:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors de la récupération du statut' });
  }
});

// Remboursement PayPal dédié conservé pour compatibilité (le remboursement
// unifié POST /:id/refund ci-dessous couvre aussi PayPal automatiquement).
router.post('/paypal/refund/:paymentId', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    const { amount } = req.body;
    if (isNaN(paymentId)) return res.status(400).json({ error: 'paymentId invalide' });

    const payment = await refundPaypalPayment(paymentId, amount ? Number(amount) : undefined);
    return res.json({ message: 'Remboursement effectué', payment });
  } catch (error: any) {
    console.error('Erreur POST /payments/paypal/refund/:paymentId:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors du remboursement' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE (couvre Carte bancaire + Stripe)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/stripe/create-intent', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, appointmentId, amount, currency, type, notes } = req.body;
    if (!patientId || !amount) return res.status(400).json({ error: 'patientId et amount sont requis' });

    const result = await createStripePaymentIntent({
      patientId: Number(patientId),
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      amount: Number(amount),
      currency, type, notes,
    });

    return res.status(201).json({
      message: 'PaymentIntent Stripe créé',
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('Erreur POST /payments/stripe/create-intent:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors de la création du paiement Stripe' });
  }
});

router.get('/stripe/status/:paymentIntentId', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncStripePaymentStatus(req.params.paymentIntentId);
    return res.json(result);
  } catch (error: any) {
    console.error('Erreur GET /payments/stripe/status/:paymentIntentId:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors de la synchronisation du statut Stripe' });
  }
});

// IMPORTANT : nécessite le corps brut (raw) pour vérifier la signature Stripe.
// À monter AVANT tout express.json() global pour cette route, ou monter ce routeur séparément.
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  let event;

  try {
    event = stripeClient.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error: any) {
    console.error('Erreur signature webhook Stripe:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    await handleStripeWebhookEvent(event);
    return res.json({ received: true });
  } catch (error: any) {
    console.error('Erreur traitement webhook Stripe:', error);
    return res.status(500).json({ error: 'Erreur lors du traitement du webhook' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PAIEMENT AU CABINET (espèces, chèque, virement — confirmation manuelle)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/cabinet', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, appointmentId, amount, currency, method, type, notes } = req.body;
    if (!patientId || !amount || !method) {
      return res.status(400).json({ error: 'patientId, amount et method sont requis' });
    }

    const payment = await recordCabinetPayment({
      patientId: Number(patientId),
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      amount: Number(amount),
      currency,
      method,
      type,
      confirmedBy: req.user!.id,
      notes,
    });

    return res.status(201).json({ message: 'Paiement au cabinet enregistré', payment });
  } catch (error: any) {
    console.error('Erreur POST /payments/cabinet:', error);
    return res.status(400).json({ error: error.message || "Erreur lors de l'enregistrement du paiement" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REMBOURSEMENT UNIFIÉ (dispatch selon la méthode du paiement)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/:id/refund', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    const { amount } = req.body;
    if (isNaN(paymentId)) return res.status(400).json({ error: 'ID de paiement invalide' });

    const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!existing) return res.status(404).json({ error: 'Paiement introuvable' });

    let payment;
    switch (existing.method) {
      case 'PAYPAL':
        payment = await refundPaypalPayment(paymentId, amount ? Number(amount) : undefined);
        break;
      case 'STRIPE':
        payment = await refundStripePayment(paymentId, amount ? Number(amount) : undefined);
        break;
      case 'ESPECES':
      case 'CHEQUE':
      case 'VIREMENT':
        payment = await refundCabinetPayment(paymentId, amount ? Number(amount) : undefined);
        break;
      default:
        return res.status(400).json({ error: 'Méthode de paiement non remboursable automatiquement' });
    }

    return res.json({ message: 'Remboursement effectué', payment });
  } catch (error: any) {
    console.error('Erreur POST /payments/:id/refund:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors du remboursement' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FACTURE PDF
// ═══════════════════════════════════════════════════════════════════════════

router.post('/:id/invoice', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) return res.status(400).json({ error: 'ID de paiement invalide' });

    const result = await generateInvoicePdf(paymentId);
    return res.status(201).json({
      message: 'Facture générée',
      invoiceUrl: result.invoiceUrl,
      invoiceNumber: result.invoiceNumber,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('Erreur POST /payments/:id/invoice:', error);
    return res.status(400).json({ error: error.message || 'Erreur lors de la génération de la facture' });
  }
});

router.get('/:id/invoice/download', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.invoiceUrl) {
      return res.status(404).json({ error: 'Aucune facture générée pour ce paiement' });
    }
    // Le fichier est servi statiquement via express.static('storage/invoices', ...) monté dans app.ts
    return res.redirect(payment.invoiceUrl);
  } catch (error: any) {
    console.error('Erreur GET /payments/:id/invoice/download:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LISTE & DÉTAIL
// ═══════════════════════════════════════════════════════════════════════════

router.get('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, status, method } = req.query;
    const whereClause: any = {};
    if (patientId && typeof patientId === 'string') whereClause.patientId = parseInt(patientId);
    if (status && typeof status === 'string') whereClause.status = status;
    if (method && typeof method === 'string') whereClause.method = method;

    const payments = await prisma.payment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { patient: true, appointment: true },
    });

    return res.json({ payments });
  } catch (error: any) {
    console.error('Erreur GET /payments:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.get('/:id', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { patient: true, appointment: true },
    });
    if (!payment) return res.status(404).json({ error: 'Paiement non trouvé' });

    return res.json({ payment });
  } catch (error: any) {
    console.error('Erreur GET /payments/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;