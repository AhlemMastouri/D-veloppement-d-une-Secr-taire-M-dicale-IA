"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// GET /api/v1/dictations (Doctors and Secretaries only)
router.get('/dictations', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['DOCTOR', 'SECRETARY']), async (req, res) => {
    try {
        const { patientId } = req.query;
        const whereClause = {};
        if (patientId) {
            whereClause.patientId = parseInt(patientId);
        }
        const dictations = await db_1.default.medicalDictation.findMany({
            where: whereClause,
            include: {
                doctor: { select: { name: true } },
                patient: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ dictations });
    }
    catch (error) {
        console.error('Erreur GET /dictations:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/dictations (Doctors only - logging clinical notes dictation)
router.post('/dictations', authMiddleware_1.authenticateJWT, (0, authMiddleware_1.requireRole)(['DOCTOR']), async (req, res) => {
    try {
        const { patientId, rawTranscript, summary, notes } = req.body;
        const doctorId = req.user.id;
        if (!patientId || !rawTranscript) {
            return res.status(400).json({ error: 'Le patientId et le rawTranscript (transcription brute) sont requis' });
        }
        // Generate mock clinical summary/notes if not provided
        const resolvedSummary = summary || `Résumé clinique de l'examen de ${new Date().toLocaleDateString('fr-FR')}.`;
        const resolvedNotes = notes || `Note clinique: ${rawTranscript.substring(0, 100)}...`;
        // Generate a mock PDF export link
        const pdfUrl = `/exports/dictation_patient_${patientId}_${Date.now()}.pdf`;
        const dictation = await db_1.default.medicalDictation.create({
            data: {
                doctorId,
                patientId: parseInt(patientId),
                rawTranscript,
                summary: resolvedSummary,
                notes: resolvedNotes,
                exportPdfUrl: pdfUrl,
            },
            include: {
                patient: { select: { firstName: true, lastName: true } },
            },
        });
        return res.status(201).json({
            message: 'Dictée médicale enregistrée avec succès. Rapport PDF généré en arrière-plan.',
            dictation,
        });
    }
    catch (error) {
        console.error('Erreur POST /dictations:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// POST /api/v1/ocr/parse (Simulates automatic reading of card/document - CDC Section 4.11)
// Payload: docType ('carte_vitale' | 'ordonnance' | 'cin' | 'mutuelle')
router.post('/ocr/parse', async (req, res) => {
    try {
        const { docType } = req.body;
        if (!docType) {
            return res.status(400).json({ error: 'Le type de document (docType) est requis' });
        }
        let parsedData = {};
        switch (docType) {
            case 'carte_vitale':
                parsedData = {
                    numSecu: '1 90 05 75 001 123 45',
                    lastName: 'Dubois',
                    firstName: 'Alice',
                    dob: '1990-05-15',
                    rightsValidUntil: '2027-12-31',
                };
                break;
            case 'ordonnance':
                parsedData = {
                    prescribingDoctor: 'Dr. Jean Dupont',
                    date: new Date().toISOString().split('T')[0],
                    medications: [
                        { name: 'Paracétamol 1g', dosage: '1 comprimé 3 fois par jour', duration: '3 jours' },
                        { name: 'Amoxicilline 1g', dosage: '1 gélule matin et soir', duration: '6 jours' },
                    ],
                };
                break;
            case 'mutuelle':
                parsedData = {
                    company: 'Aésio Mutuelle',
                    contractNumber: 'AES-99887766',
                    garanties: 'Tiers Payant Intégral',
                    validUntil: '2026-12-31',
                };
                break;
            case 'cin':
            case 'passport':
                parsedData = {
                    docNumber: '26AA12345',
                    lastName: 'Dubois',
                    firstName: 'Alice',
                    dob: '1990-05-15',
                    nationality: 'Française',
                    expiryDate: '2035-10-12',
                };
                break;
            default:
                return res.status(400).json({ error: `Type de document '${docType}' non supporté pour la simulation OCR` });
        }
        return res.json({
            message: `Simulation OCR réussie pour le document de type '${docType}'`,
            documentType: docType,
            parsedData,
        });
    }
    catch (error) {
        console.error('Erreur POST /ocr/parse:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
