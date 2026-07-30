// src/ai/voice/languageDetector.ts

import { callLLMJson } from "../nlu/llmClient";
import { SupportedLanguage } from "../types/call.types";

interface LanguageDetectionResult {
  language: SupportedLanguage;
  confidence: number;
}

const SYSTEM_PROMPT = `Tu es un détecteur de langue pour un standard téléphonique médical.
Analyse le texte transcrit d'un patient et détermine dans quelle langue il parle.

Langues possibles UNIQUEMENT : fr (français), en (anglais), ar (arabe), it (italien), es (espagnol).

Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{ "language": "fr", "confidence": 0.95 }

Si le texte est ambigu ou trop court pour être sûr, mets confidence bas (< 0.5).`;

const SUPPORTED_CODES = new Set(Object.values(SupportedLanguage));

/**
 * Détecte la langue parlée à partir d'un segment de texte transcrit.
 * Utilisé au début de l'appel, et à chaque tour pour capter un changement de langue.
 */
export async function detectLanguage(
  transcript: string
): Promise<LanguageDetectionResult> {
  // Court-circuit : texte trop court pour être fiable, on évite un appel LLM inutile
  if (transcript.trim().length < 3) {
    return { language: SupportedLanguage.FRENCH, confidence: 0 };
  }

  try {
    const result = await callLLMJson<{ language: string; confidence: number }>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Texte : "${transcript}"`,
      temperature: 0,
    });

    const language = SUPPORTED_CODES.has(result.language as SupportedLanguage)
      ? (result.language as SupportedLanguage)
      : SupportedLanguage.FRENCH;

    return {
      language,
      confidence: clamp(result.confidence ?? 0, 0, 1),
    };
  } catch (err) {
    console.error("[languageDetector] Échec détection:", err);
    // Fallback prudent : français par défaut plutôt que de bloquer l'appel
    return { language: SupportedLanguage.FRENCH, confidence: 0 };
  }
}

/**
 * Décide si on doit basculer la langue de la conversation.
 *
 * Logique :
 * - Tant que la langue n'est pas "verrouillée" (languageLocked = false),
 *   on prend la langue détectée dès qu'elle est raisonnablement fiable.
 * - Une fois verrouillée (après le 1er tour confirmé), on ne rebascule
 *   que si la nouvelle détection est très confiante (évite les faux
 *   positifs sur un mot isolé en anglais dans une phrase française, ex: "ok").
 */
export function resolveLanguageSwitch(
  currentLanguage: SupportedLanguage,
  languageLocked: boolean,
  detection: LanguageDetectionResult
): { language: SupportedLanguage; shouldLock: boolean } {
  const CONFIDENCE_THRESHOLD_INITIAL = 0.5;
  const CONFIDENCE_THRESHOLD_SWITCH = 0.85;

  if (!languageLocked) {
    if (detection.confidence >= CONFIDENCE_THRESHOLD_INITIAL) {
      return { language: detection.language, shouldLock: true };
    }
    return { language: currentLanguage, shouldLock: false };
  }

  if (
    detection.language !== currentLanguage &&
    detection.confidence >= CONFIDENCE_THRESHOLD_SWITCH
  ) {
    return { language: detection.language, shouldLock: true };
  }

  return { language: currentLanguage, shouldLock: true };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
