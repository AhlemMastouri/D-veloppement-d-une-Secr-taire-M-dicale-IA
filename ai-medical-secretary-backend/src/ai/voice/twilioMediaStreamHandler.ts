// src/ai/voice/twilioMediaStreamHandler.ts
//
// Nécessite : npm install ws
// Serveur WebSocket branché sur ton serveur HTTP existant (voir exemple de câblage en bas).

import { WebSocket } from "ws";
import { createStreamingRecognition } from "./sttService";
import { synthesizeSpeech, encodeAudioForTwilio } from "./ttsService";
import { detectLanguage, resolveLanguageSwitch } from "./languageDetector";
import { SupportedLanguage, VoiceCallState } from "../types/call.types";

// Remplace ceci par ton vrai pipeline (dialogueManager) une fois branché
async function generateReply(
  transcript: string,
  language: SupportedLanguage
): Promise<string> {
  // Placeholder — à remplacer par : intentClassifier -> entityExtractor ->
  // dialogueManager -> responseGenerator
  return "Merci, un instant s'il vous plaît.";
}

interface StreamSession {
  callId: string;
  state: VoiceCallState;
  stt: ReturnType<typeof createStreamingRecognition>;
  isBotSpeaking: boolean;
}

/**
 * Gère une connexion WebSocket Twilio Media Stream de bout en bout :
 * - reçoit les événements "start" / "media" / "stop" de Twilio
 * - transcrit l'audio en continu
 * - détecte/adapte la langue
 * - gère l'interruption naturelle (barge-in) : si le patient parle
 *   pendant que le bot répond, on coupe la voix du bot
 * - renvoie la réponse audio (TTS) dans le flux
 */
export function handleTwilioMediaStream(ws: WebSocket) {
  let session: StreamSession | null = null;

  ws.on("message", async (raw: string) => {
    const msg = JSON.parse(raw);

    switch (msg.event) {
      case "start": {
        const callId = msg.start.callSid;
        const initialLanguage = SupportedLanguage.FRENCH; // langue par défaut au décroché

        session = {
          callId,
          isBotSpeaking: false,
          state: {
            callId,
            currentIntent: undefined as any, // sera défini par le pipeline NLU
            collectedEntities: {},
            missingFields: [],
            turnCount: 0,
            history: [],
            status: "collecting",
            updatedAt: new Date().toISOString(),
            language: initialLanguage,
            languageLocked: false,
          },
          stt: createStreamingRecognition(initialLanguage, (transcript, isFinal) =>
            onTranscript(ws, session!, transcript, isFinal)
          ),
        };
        break;
      }

      case "media": {
        if (!session) return;
        const audioChunk = Buffer.from(msg.media.payload, "base64");

        // Interruption naturelle : si le patient parle pendant que le bot
        // parle encore, on coupe immédiatement l'audio du bot côté Twilio.
        if (session.isBotSpeaking) {
          ws.send(
            JSON.stringify({
              event: "clear",
              streamSid: msg.streamSid,
            })
          );
          session.isBotSpeaking = false;
        }

        session.stt.write(audioChunk);
        break;
      }

      case "stop": {
        session?.stt.end();
        session = null;
        break;
      }
    }
  });

  ws.on("close", () => {
    session?.stt.end();
  });
}

/**
 * Appelé à chaque transcript (partiel ou final) reçu du STT.
 * On ne déclenche le pipeline complet que sur les transcripts finaux,
 * pour éviter de traiter une phrase incomplète.
 */
async function onTranscript(
  ws: WebSocket,
  session: StreamSession,
  transcript: string,
  isFinal: boolean
) {
  if (!isFinal) return; // les résultats partiels ne servent qu'à détecter l'interruption

  session.state.history.push({
    role: "patient",
    message: transcript,
    timestamp: new Date().toISOString(),
  });

  // 1. Détection de langue et résolution du changement éventuel
  const detection = await detectLanguage(transcript);
  const { language, shouldLock } = resolveLanguageSwitch(
    session.state.language,
    session.state.languageLocked,
    detection
  );
  session.state.language = language;
  session.state.languageLocked = shouldLock;

  // 2. Génération de la réponse (à remplacer par le pipeline NLU complet)
  const replyText = await generateReply(transcript, language);

  session.state.history.push({
    role: "ia",
    message: replyText,
    timestamp: new Date().toISOString(),
  });

  // 3. Synthèse vocale dans la bonne langue et envoi à Twilio
  const audioBuffer = await synthesizeSpeech(replyText, language);
  session.isBotSpeaking = true;

  ws.send(
    JSON.stringify({
      event: "media",
      media: { payload: encodeAudioForTwilio(audioBuffer) },
    })
  );
}

/*
--- Câblage dans ton serveur Express existant (server.ts) ---

import http from "http";
import { WebSocketServer } from "ws";
import { handleTwilioMediaStream } from "./ai/voice/twilioMediaStreamHandler";

const server = http.createServer(app); // ton app Express existante
const wss = new WebSocketServer({ server, path: "/voice/media-stream" });

wss.on("connection", handleTwilioMediaStream);

server.listen(process.env.PORT || 3000);
*/
