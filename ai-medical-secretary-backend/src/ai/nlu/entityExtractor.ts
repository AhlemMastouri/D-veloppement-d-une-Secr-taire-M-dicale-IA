// src/ai/nlu/entityExtractor.ts

import { callLLMJson } from "./llmClient";
import {
  CallIntent,
  ExtractedEntities,
  EntityExtractionResult,
} from "../types/call.types";

const SYSTEM_PROMPT = `Tu es un module d'extraction d'entités pour une secrétaire médicale IA.
Ton rôle : lire un message de patient (en français) et en extraire des informations structurées.

Règles strictes :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises markdown.
- Si une information n'est pas présente dans le message, ne mets pas la clé (ou mets null).
- Normalise les dates au format ISO (YYYY-MM-DD) en te basant sur la date du jour fournie.
- Normalise les heures au format 24h (HH:mm).
- Si le patient dit "demain", "jeudi prochain", "dans deux jours", calcule la date réelle.
- Le champ "confidence" est un nombre entre 0 et 1 qui reflète ta certitude globale sur l'extraction.

Format de réponse attendu :
{
  "date": "2026-08-03" | null,
  "time": "14:30" | null,
  "doctorName": "Dr Ben Salah" | null,
  "reason": "consultation de suivi" | null,
  "patientPhone": "+21612345678" | null,
  "patientName": "Ahlem Trabelsi" | null,
  "confidence": 0.9
}`;

interface RawExtraction extends ExtractedEntities {
  confidence: number;
}

/**
 * Extrait les entités pertinentes d'un message patient, en tenant compte
 * de l'intent déjà détecté (pour guider ce qu'on cherche) et de la date du jour
 * (indispensable pour normaliser les expressions relatives comme "demain").
 */
export async function extractEntities(
  message: string,
  intent: CallIntent,
  referenceDate: Date = new Date()
): Promise<EntityExtractionResult> {
  const todayISO = referenceDate.toISOString().split("T")[0];

  const userPrompt = `Date du jour : ${todayISO}
Intent détecté : ${intent}
Message du patient : "${message}"

Extrait les entités selon le format demandé.`;

  try {
    const raw = await callLLMJson<RawExtraction>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
    });

    const entities = sanitizeEntities(raw);

    return {
      entities,
      confidence: clamp(raw.confidence ?? 0.5, 0, 1),
    };
  } catch (err) {
    console.error("[entityExtractor] Échec extraction LLM:", err);
    // Fallback : extraction vide plutôt que de faire planter le pipeline
    return { entities: {}, confidence: 0 };
  }
}

/**
 * Fusionne les nouvelles entités extraites avec celles déjà connues
 * dans le contexte de conversation (les nouvelles valeurs écrasent les anciennes
 * seulement si elles sont non vides).
 */
export function mergeEntities(
  existing: ExtractedEntities,
  incoming: ExtractedEntities
): ExtractedEntities {
  const merged: ExtractedEntities = { ...existing };

  for (const key of Object.keys(incoming) as (keyof ExtractedEntities)[]) {
    const value = incoming[key];
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  }

  return merged;
}

// --- Helpers internes ---

function sanitizeEntities(raw: RawExtraction): ExtractedEntities {
  const cleaned: ExtractedEntities = {};

  if (raw.date && isValidISODate(raw.date)) cleaned.date = raw.date;
  if (raw.time && isValidTime(raw.time)) cleaned.time = raw.time;
  if (raw.doctorName) cleaned.doctorName = raw.doctorName.trim();
  if (raw.reason) cleaned.reason = raw.reason.trim();
  if (raw.patientPhone) cleaned.patientPhone = raw.patientPhone.trim();
  if (raw.patientName) cleaned.patientName = raw.patientName.trim();

  return cleaned;
}

function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
