import express from 'express';
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

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS & JSON parsing
app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Serveur démarré avec succès sur le port ${PORT}`);
  console.log(`L'API est accessible sur http://localhost:${PORT}`);
});
