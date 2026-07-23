"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/v1/calls (Admin, Secretary, Doctor only)
// Query filters: classification, direction, patientId
router.get('/', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN', 'SECRETARY', 'DOCTOR']), async (req, res) => {
    try {
        const { classification, direction, patientId } = req.query;
        const whereClause = {};
        if (classification) {
            whereClause.classification = classification;
        }
        if (direction) {
            whereClause.direction = direction;
        }
        if (patientId) {
            whereClause.patientId = parseInt(patientId);
        }
        const calls = await db_1.default.callLog.findMany({
            where: whereClause,
            include: {
                patient: {
                    select: {
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
            },
            orderBy: { startTime: 'desc' },
        });
        return res.json({ calls });
    }
    catch (error) {
        console.error('Erreur GET /calls:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// GET /api/v1/calls/stats (Admin, Secretary, Doctor only)
// Computes metrics specified in CDC section 4.13
router.get('/stats', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN', 'SECRETARY', 'DOCTOR']), async (req, res) => {
    try {
        // 1. Total number of calls
        const totalCalls = await db_1.default.callLog.count();
        // 2. Missed calls
        const missedCalls = await db_1.default.callLog.count({
            where: { status: 'MISSED' },
        });
        // 3. Average duration of calls (in seconds)
        const callsWithDuration = await db_1.default.callLog.aggregate({
            _avg: {
                duration: true,
            },
            where: {
                status: 'COMPLETED',
                duration: { not: null },
            },
        });
        const avgDuration = Math.round(callsWithDuration._avg.duration || 0);
        // 4. Appointments taken (total count of appointments, or appointments booked by AI calls)
        const apptsCount = await db_1.default.appointment.count();
        // 5. Cancellation rate
        const cancelledAppts = await db_1.default.appointment.count({
            where: { status: 'CANCELLED' },
        });
        const totalAppts = await db_1.default.appointment.count();
        const cancellationRate = totalAppts > 0 ? parseFloat(((cancelledAppts / totalAppts) * 100).toFixed(1)) : 0;
        // 6. Time saved (e.g. 2.5 minutes per handled call)
        const completedCallsCount = await db_1.default.callLog.count({
            where: { status: 'COMPLETED' },
        });
        const timeSavedMinutes = completedCallsCount * 2.5;
        // 7. Patient satisfaction mock score (e.g., 4.7 / 5.0)
        const patientSatisfaction = 4.8;
        return res.json({
            stats: {
                totalCalls,
                missedCalls,
                averageDurationSeconds: avgDuration,
                appointmentsTaken: apptsCount,
                cancellationRatePercent: cancellationRate,
                timeSavedMinutes,
                patientSatisfactionScore: patientSatisfaction,
            },
        });
    }
    catch (error) {
        console.error('Erreur GET /calls/stats:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/calls (Can be logged by the telephony / AI connector system)
router.post('/', async (req, res) => {
    try {
        const { direction, phoneNumber, status, duration, transcript, summary, classification, language, patientId } = req.body;
        if (!direction || !phoneNumber || !status) {
            return res.status(400).json({ error: 'La direction, le numéro de téléphone et le statut de l\'appel sont requis' });
        }
        // Try to auto-link to a patient by phone number if patientId not supplied
        let resolvedPatientId = patientId ? parseInt(patientId) : null;
        if (!resolvedPatientId) {
            const patient = await db_1.default.patient.findUnique({
                where: { phone: phoneNumber },
            });
            if (patient) {
                resolvedPatientId = patient.id;
            }
        }
        const log = await db_1.default.callLog.create({
            data: {
                direction,
                phoneNumber,
                status,
                duration: duration ? parseInt(duration) : null,
                transcript,
                summary,
                classification,
                language: language || 'Français',
                patientId: resolvedPatientId,
            },
        });
        return res.status(201).json({ message: 'Journal d\'appel créé avec succès', callLog: log });
    }
    catch (error) {
        console.error('Erreur POST /calls:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
