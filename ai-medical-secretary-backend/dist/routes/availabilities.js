"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/v1/availabilities
// Query: doctorId (optional)
router.get('/', async (req, res) => {
    try {
        const { doctorId } = req.query;
        let whereClause = {};
        if (doctorId) {
            const parsedId = parseInt(doctorId);
            if (!isNaN(parsedId)) {
                whereClause = { doctorId: parsedId };
            }
        }
        const availabilities = await db_1.default.doctorAvailability.findMany({
            where: whereClause,
            include: {
                doctor: {
                    select: {
                        name: true,
                        specialty: true,
                    },
                },
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { specificDate: 'asc' },
                { startTime: 'asc' },
            ],
        });
        return res.json({ availabilities });
    }
    catch (error) {
        console.error('Erreur GET /availabilities:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/availabilities (Doctor or Admin only)
router.post('/', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const { doctorId, dayOfWeek, startTime, endTime, specificDate, isAvailable } = req.body;
        if (!doctorId || !startTime || !endTime) {
            return res.status(400).json({ error: 'Le doctorId, l\'heure de début et l\'heure de fin sont requis' });
        }
        // Validate that dayOfWeek OR specificDate is provided
        if (dayOfWeek === undefined && !specificDate) {
            return res.status(400).json({ error: 'Vous devez spécifier soit un jour de la semaine (dayOfWeek), soit une date spécifique (specificDate)' });
        }
        const availability = await db_1.default.doctorAvailability.create({
            data: {
                doctorId: parseInt(doctorId),
                dayOfWeek: dayOfWeek !== undefined ? parseInt(dayOfWeek) : null,
                startTime,
                endTime,
                specificDate: specificDate ? new Date(specificDate) : null,
                isAvailable: isAvailable !== undefined ? !!isAvailable : true,
            },
        });
        return res.status(201).json({ message: 'Disponibilité créée avec succès', availability });
    }
    catch (error) {
        console.error('Erreur POST /availabilities:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// DELETE /api/v1/availabilities/:id (Doctor or Admin only)
router.delete('/:id', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['DOCTOR', 'ADMIN']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de disponibilité invalide' });
        }
        const availabilityExists = await db_1.default.doctorAvailability.findUnique({ where: { id } });
        if (!availabilityExists) {
            return res.status(404).json({ error: 'Disponibilité non trouvée' });
        }
        await db_1.default.doctorAvailability.delete({ where: { id } });
        return res.json({ message: 'Disponibilité supprimée avec succès' });
    }
    catch (error) {
        console.error('Erreur DELETE /availabilities/:id:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
