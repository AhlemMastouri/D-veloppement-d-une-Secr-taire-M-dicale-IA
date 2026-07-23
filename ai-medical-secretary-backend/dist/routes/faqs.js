"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/v1/faqs
// Query filters: category
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const whereClause = {};
        if (category) {
            whereClause.category = category;
        }
        const faqs = await db_1.default.faq.findMany({
            where: whereClause,
            orderBy: { category: 'asc' },
        });
        return res.json({ faqs });
    }
    catch (error) {
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
        const faqs = await db_1.default.faq.findMany({
            where: {
                OR: [
                    { question: { contains: q } },
                    { answer: { contains: q } },
                ],
            },
        });
        return res.json({ faqs });
    }
    catch (error) {
        console.error('Erreur GET /faqs/search:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/faqs (Admin only)
router.post('/', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN']), async (req, res) => {
    try {
        const { question, answer, category } = req.body;
        if (!question || !answer || !category) {
            return res.status(400).json({ error: 'La question, la réponse et la catégorie sont requises' });
        }
        const faq = await db_1.default.faq.create({
            data: {
                question,
                answer,
                category,
            },
        });
        return res.status(201).json({ message: 'FAQ ajoutée avec succès', faq });
    }
    catch (error) {
        console.error('Erreur POST /faqs:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
