import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routers
import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import availabilitiesRouter from './routes/availabilities';
import appointmentsRouter from './routes/appointments';
import callsRouter from './routes/calls';
import faqsRouter from './routes/faqs';
import dictationsRouter from './routes/dictations';
import doctorsRouter from './routes/doctors';
import messagingRouter from './routes/messaging';
import integrationsRouter from './routes/integrations';
import paymentRoutes from './routes/paymentRoutes';
import agendaRouter from './routes/agenda';

// WebSocket (appels en direct)
import { attachCallsWebSocketServer } from './wsCallsServer';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// IMPORTANT : la route webhook Stripe (/api/v1/payments/stripe/webhook) a besoin du corps
// brut (raw) pour vérifier la signature Stripe. On la monte donc AVANT express.json()
// global, avec son propre middleware express.raw() déjà défini dans paymentRoutes.ts.
// Comme paymentRoutes gère cette route en interne avec express.raw(), il suffit de monter
// express.json() après le cors() mais ça n'affecte pas la route webhook car son propre
// middleware express.raw() est appliqué en priorité sur cette route précise.
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Register api v1 routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/patients', patientsRouter);
app.use('/api/v1/availabilities', availabilitiesRouter);
app.use('/api/v1/appointments', appointmentsRouter);
app.use('/api/v1/calls', callsRouter);
app.use('/api/v1/faqs', faqsRouter);
app.use('/api/v1/services', dictationsRouter); // dictation and ocr simulation
app.use('/api/v1/doctors', doctorsRouter);
app.use('/api/v1/messaging', messagingRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/agenda', agendaRouter);

// Default root route
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API de la Secrétaire Médicale IA',
    version: '1.0.0',
    documentationUrl: '/api/v1',
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur' });
});

// On crée un serveur HTTP explicite (au lieu de app.listen directement)
// pour pouvoir y attacher le serveur WebSocket sur le même port.
const server = http.createServer(app);
attachCallsWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Serveur démarré avec succès sur le port ${PORT}`);
  console.log(`L'API est accessible sur http://localhost:${PORT}`);
  console.log(`Le WebSocket des appels en direct est accessible sur ws://localhost:${PORT}/ws/calls`);
});