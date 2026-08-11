import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from '../config/db';

const INVOICES_DIR = process.env.INVOICES_DIR || path.join(process.cwd(), 'storage', 'invoices');

if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

const METHOD_LABELS: Record<string, string> = {
  PAYPAL: 'PayPal',
  STRIPE: 'Carte bancaire / Stripe',
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement bancaire',
};

// ─── Génère une facture PDF pour un paiement complété et enregistre son URL ─
export async function generateInvoicePdf(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { patient: true, appointment: true },
  });

  if (!payment) throw new Error('Paiement introuvable');
  if (payment.status !== 'COMPLETED' && !payment.status.includes('REFUND')) {
    throw new Error('Seul un paiement complété (ou remboursé) peut générer une facture');
  }

  const fileName = `facture-${payment.id}-${Date.now()}.pdf`;
  const filePath = path.join(INVOICES_DIR, fileName);
  const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(payment.id).padStart(5, '0')}`;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // En-tête cabinet
    doc.fontSize(18).text('Cabinet Médical', { align: 'left' });
    doc.fontSize(10).fillColor('#555').text('12 rue de la Santé, 75005 Paris');
    doc.text('contact@cabinet-medical.fr — 01 23 45 67 89');
    doc.moveDown(2);

    // Titre facture
    doc.fillColor('#000').fontSize(16).text(`Facture ${invoiceNumber}`, { align: 'right' });
    doc.fontSize(10).fillColor('#555').text(`Date : ${new Date(payment.createdAt).toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(2);

    // Informations patient
    doc.fillColor('#000').fontSize(12).text('Facturé à :');
    doc.fontSize(10).fillColor('#333').text(`${payment.patient.firstName} ${payment.patient.lastName}`);
    if (payment.patient.email) doc.text(payment.patient.email);
    if (payment.patient.phone) doc.text(payment.patient.phone);
    doc.moveDown(2);

    // Tableau simplifié
    const label = payment.type === 'DEPOSIT' ? 'Acompte' : 'Consultation médicale';
    doc.fillColor('#000').fontSize(12).text('Détail', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text(`${label}${payment.appointmentId ? ` (RDV #${payment.appointmentId})` : ''}`);
    if (payment.notes) doc.fillColor('#666').text(payment.notes);
    doc.moveDown(1);

    doc.fillColor('#000').fontSize(11).text(`Moyen de paiement : ${METHOD_LABELS[payment.method] || payment.method}`);
    doc.text(`Statut : ${payment.status}`);
    doc.moveDown(1);

    doc.fontSize(14).text(`Total : ${Number(payment.amount).toFixed(2)} ${payment.currency}`, { align: 'right' });

    doc.moveDown(3);
    doc.fontSize(8).fillColor('#999').text(
      "Document généré automatiquement — ne constitue pas une facture normalisée CPAM.",
      { align: 'center' }
    );

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  const invoiceUrl = `/invoices/${fileName}`;

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { invoiceUrl },
  });

  return { payment: updated, invoiceUrl, filePath, invoiceNumber };
}
