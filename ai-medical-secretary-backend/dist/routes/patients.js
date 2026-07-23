"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/v1/patients (Admin, Secretary, Doctor only)
// Query params: search (searches lastName, firstName, phone)
router.get('/', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN', 'SECRETARY', 'DOCTOR']), async (req, res) => {
    try {
        const { search } = req.query;
        let whereClause = {};
        if (search && typeof search === 'string') {
            whereClause = {
                OR: [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { phone: { contains: search } },
                ],
            };
        }
        const patients = await db_1.default.patient.findMany({
            where: whereClause,
            orderBy: { lastName: 'asc' },
        });
        return res.json({ patients });
    }
    catch (error) {
        console.error('Erreur GET /patients:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// GET /api/v1/patients/:id (Admin, Secretary, Doctor only)
router.get('/:id', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN', 'SECRETARY', 'DOCTOR']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de patient invalide' });
        }
        const patient = await db_1.default.patient.findUnique({
            where: { id },
            include: {
                appointments: {
                    orderBy: { startTime: 'desc' },
                    include: { doctor: { select: { name: true, specialty: true } } },
                },
                callLogs: {
                    orderBy: { startTime: 'desc' },
                },
                dictations: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!patient) {
            return res.status(404).json({ error: 'Patient non trouvé' });
        }
        return res.json({ patient });
    }
    catch (error) {
        console.error('Erreur GET /patients/:id:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/patients (Open or Authenticated - can be called by AI Secretary)
router.post('/', async (req, res) => {
    try {
        const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;
        if (!firstName || !lastName || !dob || !phone) {
            return res.status(400).json({ error: 'Le prénom, nom, date de naissance et téléphone sont requis' });
        }
        // Check if patient with this phone already exists
        const existingPatient = await db_1.default.patient.findUnique({
            where: { phone },
        });
        if (existingPatient) {
            return res.status(409).json({ error: 'Un patient avec ce numéro de téléphone existe déjà', patient: existingPatient });
        }
        const patient = await db_1.default.patient.create({
            data: {
                firstName,
                lastName,
                dob: new Date(dob),
                phone,
                email,
                insurance,
                treatingPhysician,
                consentGdpr: !!consentGdpr,
            },
        });
        return res.status(201).json({ message: 'Patient créé avec succès', patient });
    }
    catch (error) {
        console.error('Erreur POST /patients:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// PUT /api/v1/patients/:id (Admin, Secretary, Doctor only)
router.put('/:id', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['ADMIN', 'SECRETARY', 'DOCTOR']), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'ID de patient invalide' });
        }
        const { firstName, lastName, dob, phone, email, insurance, treatingPhysician, consentGdpr } = req.body;
        // Check if patient exists
        const patientExists = await db_1.default.patient.findUnique({ where: { id } });
        if (!patientExists) {
            return res.status(404).json({ error: 'Patient non trouvé' });
        }
        // Check if phone number is being changed to another patient's phone
        if (phone && phone !== patientExists.phone) {
            const phoneConflict = await db_1.default.patient.findUnique({ where: { phone } });
            if (phoneConflict) {
                return res.status(409).json({ error: 'Un autre patient possède déjà ce numéro de téléphone' });
            }
        }
        const updatedPatient = await db_1.default.patient.update({
            where: { id },
            data: {
                firstName: firstName !== undefined ? firstName : undefined,
                lastName: lastName !== undefined ? lastName : undefined,
                dob: dob !== undefined ? new Date(dob) : undefined,
                phone: phone !== undefined ? phone : undefined,
                email: email !== undefined ? email : undefined,
                insurance: insurance !== undefined ? insurance : undefined,
                treatingPhysician: treatingPhysician !== undefined ? treatingPhysician : undefined,
                consentGdpr: consentGdpr !== undefined ? !!consentGdpr : undefined,
            },
        });
        return res.json({ message: 'Patient mis à jour avec succès', patient: updatedPatient });
    }
    catch (error) {
        console.error('Erreur PUT /patients/:id:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
