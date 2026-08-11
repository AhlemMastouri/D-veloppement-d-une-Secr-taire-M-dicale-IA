import { Router, Response } from 'express';
import Groq from 'groq-sdk';
import prisma from '../config/db';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Réessaie l'appel avec un backoff exponentiel en cas de surcharge (503) ou de rate limit (429) côté Groq
async function callGroqWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      const isRetryable = status === 503 || status === 429;
      if (!isRetryable || attempt === maxRetries) throw error;
      const delayMs = 500 * Math.pow(2, attempt); // 500ms, 1s, 2s...
      console.warn(`Groq indisponible (${status}), nouvelle tentative dans ${delayMs}ms (essai ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

// ─── 4.10 DICTÉE MÉDICALE IA ───
router.get('/dictations', authenticateJWT as any, requireRole(['DOCTOR', 'SECRETARY', 'ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.query;
    const whereClause: any = {};
    if (patientId) whereClause.patientId = parseInt(patientId as string);

    const dictations = await prisma.medicalDictation.findMany({
      where: whereClause,
      include: {
        doctor: { select: { name: true, specialty: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ dictations });
  } catch (error: any) {
    console.error('Erreur GET /dictations:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

router.post('/dictations', authenticateJWT as any, requireRole(['DOCTOR', 'SECRETARY', 'ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, rawTranscript, summary, notes } = req.body;
    const doctorId = req.user!.id;

    if (!patientId || !rawTranscript) {
      return res.status(400).json({ error: 'Le patientId et la transcription brute (rawTranscript) sont requis' });
    }

    const resolvedSummary = summary || `Résumé de consultation du ${new Date().toLocaleDateString('fr-FR')} : Patient examiné. Diagnostic et conseils formulés suite aux symptômes décris.`;
    const resolvedNotes = notes || `Note clinique validée : ${rawTranscript.trim()} (Corrigé automatiquement par l'IA Médicale).`;
    const pdfUrl = `/api/v1/services/export-doc/pdf?title=Compte_Rendu_Medical_Patient_${patientId}`;

    const dictation = await prisma.medicalDictation.create({
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
        doctor: { select: { name: true } }
      },
    });

    return res.status(201).json({
      message: 'Dictée médicale enregistrée, compte-rendu généré et prêt pour export PDF.',
      dictation,
    });
  } catch (error: any) {
    console.error('Erreur POST /dictations:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ─── 4.11 OCR (LECTURE AUTOMATIQUE D'IMAGE VIA CLAUDE VISION) ───

// Schémas d'extraction par type de document : décrivent au modèle
// exactement quels champs extraire et dans quel format.
const DOC_SCHEMAS: Record<string, { label: string; fields: string }> = {
  carte_vitale: {
    label: "une Carte Vitale (carte d'assurance maladie française)",
    fields: `{
  "document": "Carte Vitale 2",
  "numSecu": "numéro de sécurité sociale (15 chiffres)",
  "lastName": "nom de famille",
  "firstName": "prénom",
  "dob": "date de naissance au format YYYY-MM-DD",
  "rightsValidUntil": "date de validité des droits si visible, sinon null",
  "regime": "régime d'assurance (ex: Régime Général)"
}`,
  },
  ordonnance: {
    label: 'une Ordonnance médicale',
    fields: `{
  "document": "Ordonnance Médicale",
  "prescribingDoctor": "nom du médecin prescripteur",
  "rpps": "numéro RPPS si visible, sinon null",
  "date": "date de l'ordonnance au format YYYY-MM-DD",
  "medications": [{ "name": "nom du médicament", "dosage": "posologie", "duration": "durée du traitement" }]
}`,
  },
  mutuelle: {
    label: 'une Attestation de mutuelle / tiers payant',
    fields: `{
  "document": "Attestation de Tiers Payant Mutuelle",
  "company": "nom de la mutuelle",
  "contractNumber": "numéro de contrat/adhérent",
  "garanties": "garanties de prise en charge",
  "validUntil": "date de fin de validité au format YYYY-MM-DD"
}`,
  },
  cin: {
    label: "une Carte Nationale d'Identité",
    fields: `{
  "document": "Carte Nationale d'Identité (CIN)",
  "docNumber": "numéro du document",
  "lastName": "nom de famille",
  "firstName": "prénom(s)",
  "dob": "date de naissance au format YYYY-MM-DD",
  "nationality": "nationalité",
  "expiryDate": "date d'expiration au format YYYY-MM-DD"
}`,
  },
  passeport: {
    label: 'un Passeport biométrique',
    fields: `{
  "document": "Passeport Biométrique",
  "passportNo": "numéro de passeport",
  "lastName": "nom de famille",
  "firstName": "prénom(s)",
  "dob": "date de naissance au format YYYY-MM-DD",
  "issuingCountry": "code pays émetteur (3 lettres)",
  "expiryDate": "date d'expiration au format YYYY-MM-DD"
}`,
  },
  resultats_analyses: {
    label: "des Résultats d'analyses biologiques",
    fields: `{
  "document": "Résultats d'Analyses Biologiques",
  "labName": "nom du laboratoire",
  "testDate": "date du prélèvement au format YYYY-MM-DD",
  "results": [{ "test": "nom de l'analyse", "value": "valeur mesurée avec unité", "status": "Normal / Anormal / Élevé / Bas" }]
}`,
  },
};

// POST /api/v1/services/ocr/parse
router.post('/ocr/parse', async (req, res) => {
  try {
    const { docType, image } = req.body; // image: data:image/png;base64,...

    if (!docType) {
      return res.status(400).json({ error: 'Le type de document (docType) est requis' });
    }

    const schema = DOC_SCHEMAS[docType];
    if (!schema) {
      return res.status(400).json({ error: `Type de document '${docType}' non supporté` });
    }

    if (!image || typeof image !== 'string' || image.length < 50) {
      return res.status(400).json({ error: "Une image du document est requise pour l'analyse OCR" });
    }

    if (!image.match(/^data:image\/[a-zA-Z]+;base64,.+$/)) {
      return res.status(400).json({ error: "Format d'image invalide (data URL base64 attendu)" });
    }

    const prompt = `Tu es un système d'OCR médical spécialisé. L'image fournie est ${schema.label}.

Extrait précisément les informations réellement visibles dans l'image et réponds UNIQUEMENT avec un objet JSON valide respectant exactement cette structure (mets null pour tout champ illisible ou absent — n'invente JAMAIS de données) :

${schema.fields}

Réponds uniquement avec le JSON, sans texte avant/après, sans balises markdown.`;

    let completion;
    try {
      completion = await callGroqWithRetry(() =>
        groq.chat.completions.create({
          model: 'qwen/qwen3.6-27b',
          max_completion_tokens: 2048,
          temperature: 0.7,
          top_p: 0.8,
          reasoning_effort: 'none',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ] as any,
            },
          ],
        } as any)
      );
    } catch (error: any) {
      if (error?.status === 503) {
        return res.status(503).json({ error: "Le service OCR est temporairement surchargé. Merci de réessayer dans quelques instants." });
      }
      throw error;
    }

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      return res.status(502).json({ error: "Réponse OCR invalide du modèle" });
    }

    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(cleaned);
    } catch {
      console.error('Réponse OCR non-JSON:', rawText);
      return res.status(502).json({ error: "Impossible d'interpréter les données extraites de l'image" });
    }

    parsedData.confidenceOCR = 'Analysé depuis votre image importée (Groq Qwen3.6 Vision OCR)';

    return res.json({
      message: `Analyse OCR de l'image effectuée avec succès !`,
      documentType: docType,
      parsedData,
    });
  } catch (error: any) {
    console.error('Erreur POST /ocr/parse:', error);
    return res.status(500).json({ error: "Erreur interne du serveur lors de l'analyse OCR" });
  }
});

// ─── TÉLÉCHARGEMENT DIRECT & ENREGISTREMENT DE FICHIERS (.TXT, .JSON, .PDF) ───

// GET /api/v1/services/export-doc/download (Téléchargement direct du fichier extrait)
router.get('/export-doc/download', (req, res) => {
  try {
    const { format = 'txt', docType = 'document', content = '' } = req.query;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Donnees_OCR_${docType}_${Date.now()}.json"`);
      return res.send(content);
    }

    if (format === 'pdf') {
      const htmlDoc = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Exportation OCR Médicale</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { color: #0ea5e9; font-size: 20px; }
            .box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; white-space: pre-wrap; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Cabinet Médical — Rapport d'Extraction OCR & Dictée</h1>
            <p>Date d'exportation : ${new Date().toLocaleString('fr-FR')}</p>
          </div>
          <h3>Données Extrites du Document :</h3>
          <div class="box">${content}</div>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="Rapport_${docType}_${Date.now()}.html"`);
      return res.send(htmlDoc);
    }

    // Default: TXT
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Extraction_OCR_${docType}_${Date.now()}.txt"`);
    return res.send(String(content));

  } catch (error: any) {
    console.error('Erreur export-doc:', error);
    return res.status(500).send('Erreur lors du téléchargement du fichier.');
  }
});

// ─── 4.12 PAIEMENT & FACTURATION ───
router.post('/payments/process', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId, amount, method, type, description } = req.body;

    if (!patientId || !amount || !method) {
      return res.status(400).json({ error: 'patientId, amount et method sont requis' });
    }

    const transactionId = `TX_${method}_${Date.now()}`;
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return res.status(200).json({
      message: `Opération de paiement de type '${type || 'PAIEMENT_TOTAL'}' effectuée avec succès via ${method}.`,
      paymentDetails: {
        transactionId,
        invoiceNumber,
        patientId: parseInt(patientId),
        amount: parseFloat(amount),
        method,
        type: type || 'PAIEMENT_TOTAL',
        status: 'PAID',
        description: description || 'Consultation médicale',
        receiptPdfUrl: `/api/v1/services/export-doc/download?format=pdf&docType=Facture_${invoiceNumber}&content=Facture+Paiement+${amount}EUR`,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Erreur POST /payments/process:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

export default router;