import { Router, Response } from 'express';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/faqs
// Query filters: category
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    const whereClause: any = {};
    if (category) {
      whereClause.category = category as string;
    }

    const faqs = await prisma.faq.findMany({
      where: whereClause,
      orderBy: { category: 'asc' },
    });

    return res.json({ faqs });
  } catch (error: any) {
    console.error('Erreur GET /faqs:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /api/v1/faqs/search
// Query: q (search string)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Le paramètre de recherche q est requis' });
    }

    // SQLite search (contains)
    const faqs = await prisma.faq.findMany({
      where: {
        OR: [
          { question: { contains: q } },
          { answer: { contains: q } },
        ],
      },
    });

    return res.json({ faqs });
  } catch (error: any) {
    console.error('Erreur GET /faqs/search:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /api/v1/faqs (Admin only)
router.post('/', authenticateJWT as any, requireRole(['ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { question, answer, category } = req.body;

    if (!question || !answer || !category) {
      return res.status(400).json({ error: 'La question, la réponse et la catégorie sont requises' });
    }

    const faq = await prisma.faq.create({
      data: {
        question,
        answer,
        category,
      },
    });

    return res.status(201).json({ message: 'FAQ ajoutée avec succès', faq });
  } catch (error: any) {
    console.error('Erreur POST /faqs:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;
