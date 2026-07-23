"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Import routers
const auth_1 = __importDefault(require("./routes/auth"));
const patients_1 = __importDefault(require("./routes/patients"));
const availabilities_1 = __importDefault(require("./routes/availabilities"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const calls_1 = __importDefault(require("./routes/calls"));
const faqs_1 = __importDefault(require("./routes/faqs"));
const dictations_1 = __importDefault(require("./routes/dictations"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Enable CORS & JSON parsing
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Logger middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Register api v1 routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/patients', patients_1.default);
app.use('/api/v1/availabilities', availabilities_1.default);
app.use('/api/v1/appointments', appointments_1.default);
app.use('/api/v1/calls', calls_1.default);
app.use('/api/v1/faqs', faqs_1.default);
app.use('/api/v1/services', dictations_1.default); // dictation and ocr simulation
// Default root route
app.get('/', (req, res) => {
    res.json({
        message: 'Bienvenue sur l\'API de la Secrétaire Médicale IA',
        version: '1.0.0',
        documentationUrl: '/api/v1',
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Erreur non gérée:', err);
    res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur' });
});
app.listen(PORT, () => {
    console.log(`Serveur démarré avec succès sur le port ${PORT}`);
    console.log(`L'API est accessible sur http://localhost:${PORT}`);
});
