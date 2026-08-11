import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ─── All FAQ categories ────────────────────────────────────────────────────
const VALID_CATEGORIES = [
  'horaires', 'adresse', 'parking', 'specialites',
  'preparations', 'tarifs', 'paiement', 'examens',
  'teleconsultation',
  // call qualification
  'urgence', 'rendez-vous', 'devis', 'informations',
  'administratif', 'laboratoire', 'pharmacie',
];

// ─── Built-in auto-responses (used if no custom FAQ matches) ──────────────
export const AUTO_RESPONSES: Record<string, string> = {
  horaires: "Le cabinet est ouvert du lundi au vendredi de 8h à 19h, et le samedi de 9h à 13h. Nous sommes fermés le dimanche et les jours fériés.",
  adresse: "Le cabinet est situé au 12 rue de la Santé, 75005 Paris. Métro : ligne 5, station 'Censier-Daubenton', à 3 minutes à pied.",
  parking: "Le parking Indigo 'Place de la Concorde' est situé à 5 minutes de marche. Des places pour les personnes à mobilité réduite sont disponibles devant le cabinet.",
  specialites: "Notre cabinet dispose de spécialistes en médecine générale, cardiologie, pédiatrie, gynécologie, et dermatologie. Demandez un médecin précis pour en savoir plus.",
  preparations: "Pour la plupart des consultations : venez à jeun si une prise de sang est prévue, apportez votre carte Vitale, votre mutuelle et vos ordonnances en cours.",
  tarifs: "La consultation de médecine générale est à 25 € (secteur 1, conventionné). Les spécialistes varient de 30 à 80 €. Le tiers payant est accepté.",
  paiement: "Nous acceptons les cartes bancaires (Visa, Mastercard), les espèces, les chèques et la carte Vitale pour le tiers payant. Les paiements sans contact sont disponibles.",
  examens: "Les résultats d'examens sont transmis directement au médecin prescripteur sous 2 à 5 jours ouvrés. Vous pouvez aussi les consulter sur Mon Espace Santé (mesante.fr).",
  teleconsultation: "La téléconsultation est disponible du lundi au vendredi de 9h à 18h via notre plateforme sécurisée. Connexion par lien vidéo envoyé par SMS 15 minutes avant le rendez-vous.",
  urgence: "⚠️ URGENCE DÉTECTÉE — Transfert immédiat vers la secrétaire de garde et le SAMU (15). Ne raccrochez pas.",
  'rendez-vous': "Je peux vous aider à réserver, modifier ou annuler un rendez-vous. Quel médecin souhaitez-vous consulter et quelle date vous convient ?",
  devis: "Pour un devis médical ou un bilan de santé, veuillez préciser le type d'acte. Je peux vous mettre en relation avec notre secrétariat administratif.",
  informations: "Je peux vous donner des informations sur les horaires, l'adresse, les spécialistes ou les modalités de consultation. Quelle est votre question ?",
  administratif: "Pour toute démarche administrative (certificat médical, arrêt de travail, formulaire CPAM), veuillez contacter notre secrétariat au 01 23 45 67 89.",
  laboratoire: "Nos analyses sont réalisées en partenariat avec le Laboratoire BioMedica (50m du cabinet). Ouvert du lundi au samedi de 7h30 à 12h. Résultats en 24h.",
  pharmacie: "La Pharmacie de la Santé est située juste en face du cabinet (12 rue de la Santé). Ouverte 7j/7 de 8h à 22h.",
};

// ─── Call qualification keywords ─────────────────────────────────────────
export const CALL_KEYWORDS: Record<string, string[]> = {
  urgence:        ['urgence', 'douleur', 'poitrine', 'saignement', 'étouffement', 'évanouissement', 'grave', 'infarctus', 'accident', 'brûlure'],
  'rendez-vous':  ['rendez-vous', 'rdv', 'réserver', 'prendre', 'annuler', 'déplacer', 'consultation'],
  devis:          ['devis', 'prix', 'combien', 'tarif', 'coût', 'estimation'],
  informations:   ['information', 'renseignement', 'horaire', 'adresse', 'parking', 'spécialiste', 'disponible'],
  administratif:  ['certificat', 'arrêt travail', 'formulaire', 'cpam', 'remboursement', 'administratif', 'mutuelle'],
  laboratoire:    ['analyse', 'laboratoire', 'prise de sang', 'résultat', 'examen', 'biologie'],
  pharmacie:      ['pharmacie', 'médicament', 'ordonnance', 'renouvellement'],
};

// GET /api/v1/faqs
router.get('/', async (req, res) => {
  try {
    const { category, q } = req.query;
    const whereClause: any = {};

    if (category && typeof category === 'string') {
      whereClause.category = category;
    }
    if (q && typeof q === 'string') {
      whereClause.OR = [
        { question: { contains: q } },
        { answer:   { contains: q } },
      ];
    }

    const faqs = await prisma.faq.findMany({
      where: whereClause,
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json({ faqs, autoResponses: AUTO_RESPONSES, categories: VALID_CATEGORIES });
  } catch (error: any) {
    console.error('Erreur GET /faqs:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/faqs/search
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Paramètre q requis' });
    }

    const faqs = await prisma.faq.findMany({
      where: {
        OR: [
          { question: { contains: q } },
          { answer:   { contains: q } },
        ],
      },
    });

    // Also check auto-responses
    const matchingAuto: { category: string; answer: string }[] = [];
    const qLower = q.toLowerCase();
    for (const [cat, resp] of Object.entries(AUTO_RESPONSES)) {
      if (cat.includes(qLower) || resp.toLowerCase().includes(qLower)) {
        matchingAuto.push({ category: cat, answer: resp });
      }
    }

    return res.json({ faqs, autoResponses: matchingAuto });
  } catch (error: any) {
    console.error('Erreur GET /faqs/search:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/faqs/qualify — Classify a text/call
router.post('/qualify', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Paramètre text requis' });

    const lower = text.toLowerCase();
    let detected = 'informations';
    let confidence = 0;

    for (const [category, kws] of Object.entries(CALL_KEYWORDS)) {
      const matches = kws.filter(kw => lower.includes(kw)).length;
      if (matches > confidence) {
        confidence = matches;
        detected = category;
      }
    }

    const isEmergency = detected === 'urgence';
    const response = AUTO_RESPONSES[detected] || AUTO_RESPONSES.informations;

    return res.json({
      classification: detected,
      confidence: Math.min(confidence / 3, 1),
      isEmergency,
      autoResponse: response,
    });
  } catch (error: any) {
    console.error('Erreur POST /faqs/qualify:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/faqs — Add FAQ (Admin or Secretary)
router.post('/', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, answer, category } = req.body;
    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'Question, réponse et catégorie requises' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Catégorie invalide. Valeurs acceptées : ${VALID_CATEGORIES.join(', ')}` });
    }

    const faq = await prisma.faq.create({ data: { question, answer, category } });
    return res.status(201).json({ message: 'FAQ ajoutée', faq });
  } catch (error: any) {
    console.error('Erreur POST /faqs:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// PUT /api/v1/faqs/:id
router.put('/:id', authenticateJWT as any, requireRole(['ADMIN', 'SECRETARY']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { question, answer, category } = req.body;
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'FAQ non trouvée' });

    const updated = await prisma.faq.update({
      where: { id },
      data: {
        question: question ?? existing.question,
        answer:   answer   ?? existing.answer,
        category: category ?? existing.category,
      },
    });
    return res.json({ message: 'FAQ mise à jour', faq: updated });
  } catch (error: any) {
    console.error('Erreur PUT /faqs/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// DELETE /api/v1/faqs/:id
router.delete('/:id', authenticateJWT as any, requireRole(['ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });
    await prisma.faq.delete({ where: { id } });
    return res.json({ message: 'FAQ supprimée' });
  } catch (error: any) {
    console.error('Erreur DELETE /faqs/:id:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
