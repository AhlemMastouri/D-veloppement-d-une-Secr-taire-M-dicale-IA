// src/ai/voice/ttsService.ts
//
// Nécessite : npm install @google-cloud/text-to-speech
// Config : variable d'env GOOGLE_APPLICATION_CREDENTIALS pointant vers ton
// fichier de clé de service Google Cloud (JSON).

import textToSpeech from "@google-cloud/text-to-speech";
import { SupportedLanguage, TTS_VOICE_BY_LANGUAGE } from "../types/call.types";

const client = new textToSpeech.TextToSpeechClient();

/**
 * Convertit un texte en audio (format mulaw 8kHz, compatible Twilio) dans la langue donnée.
 * Retourne un buffer audio prêt à être renvoyé dans le flux Twilio Media Stream.
 */
export async function synthesizeSpeech(
  text: string,
  language: SupportedLanguage
): Promise<Buffer> {
  const voice = TTS_VOICE_BY_LANGUAGE[language];

  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: {
      languageCode: voice.languageCode,
      name: voice.name,
    },
    audioConfig: {
      // MULAW 8kHz = format attendu par Twilio Media Streams
      audioEncoding: "MULAW",
      sampleRateHertz: 8000,
      speakingRate: 1.0,
      pitch: 0,
    },
  });

  if (!response.audioContent) {
    throw new Error("[ttsService] Aucune donnée audio retournée par Google TTS");
  }

  return Buffer.from(response.audioContent as Uint8Array);
}

/**
 * Encode un buffer audio en base64, format attendu par le message
 * Twilio Media Stream de type "media".
 */
export function encodeAudioForTwilio(audioBuffer: Buffer): string {
  return audioBuffer.toString("base64");
}
