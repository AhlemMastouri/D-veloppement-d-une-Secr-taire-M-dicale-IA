"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'medical-secretary-super-secret-key-123!';
// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password, isPatientSpace } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email ou numéro de téléphone requis' });
        }
        // 1. Chercher d'abord dans la table Utilisateurs (Médecin, Secrétaire, Admin)
        const user = await db_1.default.user.findUnique({
            where: { email },
        });
        if (user) {
            if (password) {
                const isPasswordValid = bcrypt.compareSync(password, user.password);
                if (!isPasswordValid) {
                    return res.status(401).json({ error: 'Mot de passe incorrect' });
                }
            }
            const token = jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
            }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    specialty: user.specialty,
                },
            });
        }
        // 2. Si non trouvé dans User, chercher dans la table Patient (par email ou par téléphone)
        const patient = await db_1.default.patient.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: email }
                ]
            }
        });
        if (patient) {
            const token = jwt.sign({
                id: patient.id,
                email: patient.email || patient.phone,
                role: 'PATIENT',
                name: `${patient.firstName} ${patient.lastName}`,
            }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({
                token,
                user: {
                    id: patient.id,
                    email: patient.email || patient.phone,
                    name: `${patient.firstName} ${patient.lastName}`,
                    role: 'PATIENT',
                    phone: patient.phone,
                    insurance: patient.insurance,
                },
            });
        }
        return res.status(401).json({ error: 'Compte introuvable (Vérifiez votre email ou téléphone)' });
    }
    catch (error) {
        console.error('Erreur de connexion:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
// GET /api/v1/auth/me
router.get('/me', authMiddleware_1.authenticateJWT, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        if (req.user.role === 'PATIENT') {
            const patient = await db_1.default.patient.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    insurance: true,
                    createdAt: true,
                },
            });
            if (!patient) {
                return res.status(404).json({ error: 'Patient non trouvé' });
            }
            return res.json({
                user: {
                    id: patient.id,
                    name: `${patient.firstName} ${patient.lastName}`,
                    email: patient.email,
                    phone: patient.phone,
                    role: 'PATIENT',
                    insurance: patient.insurance,
                }
            });
        }
        const user = await db_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                specialty: true,
                createdAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        return res.json({ user });
    }
    catch (error) {
        console.error('Erreur GET /me:', error);
        return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});
exports.default = router;
