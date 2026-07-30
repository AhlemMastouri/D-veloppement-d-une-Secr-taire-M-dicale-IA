// src/ai/voice/sttService.ts
//
// Nécessite : npm install @google-cloud/speech
// Config : même credentials Google Cloud que ttsService.ts

import speech from "@google-cloud/speech";
import { SupportedLanguage } from "../types/call.types";

const client = new speech.SpeechClient();

// Codes langue Google STT (BCP-47)
const STT_LANGUAGE_CODE: Record<SupportedLanguage, string> = {
  [SupportedLanguage.FRENCH]: "fr-FR",
  [SupportedLanguage.ENGLISH]: "en-US",
  [SupportedLanguage.ARABIC]: "ar-SA",
  [SupportedLanguage.ITALIAN]: "it-IT",
  [SupportedLanguage.SPANISH]: "es-ES",
};

export type TranscriptCallback = (transcript: string, isFinal: boolean) => void;

/**
 * Ouvre un flux de reconnaissance vocale en streaming.
 * Retourne un objet avec `write()` pour envoyer des chunks audio (venant de
 * Twilio Media Stream) et `end()` pour clôturer proprement le flux.
 *
 * languageHint : langue actuelle de la conversation (peut changer en cours d'appel,
 * il faut alors fermer ce flux et en rouvrir un nouveau avec la nouvelle langue).
 */
export function createStreamingRecognition(
  languageHint: SupportedLanguage,
  onTranscript: TranscriptCallback
) {
  const recognizeStream = client
    .streamingRecognize({
      config: {
        encoding: "MULAW",
        sampleRateHertz: 8000,
        languageCode: STT_LANGUAGE_CODE[languageHint],
        // Permet à Google de basculer automatiquement entre langues proches
        alternativeLanguageCodes: Object.values(STT_LANGUAGE_CODE).filter(
          (code) => code !== STT_LANGUAGE_CODE[languageHint]
        ),
        model: "phone_call",
        useEnhanced: true,
      },
      interimResults: true, // nécessaire pour détecter l'interruption naturelle
    })
    .on("error", (err: Error) => {
      console.error("[sttService] Erreur streaming:", err);
    })
    .on("data", (data: any) => {
      const result = data.results?.[0];
      if (!result) return;

      const transcript = result.alternatives?.[0]?.transcript ?? "";
      const isFinal = result.isFinal ?? false;

      if (transcript.trim().length > 0) {
        onTranscript(transcript, isFinal);
      }
    });

  return {
    /** Envoie un chunk audio brut (base64 décodé) venant de Twilio */
    write: (audioChunk: Buffer) => {
      recognizeStream.write({ audioContent: audioChunk });
    },
    /** Ferme proprement le flux de reconnaissance */
    end: () => {
      recognizeStream.end();
    },
  };
}
