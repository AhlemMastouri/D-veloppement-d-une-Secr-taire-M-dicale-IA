// src/ai/voice/twilioMediaStreamHandler.ts
//
// Nécessite : npm install ws
// À monter sur une route SÉPARÉE de wsCallsServer.ts (ex: /voice/media-stream),
// car Twilio ne peut pas s'authentifier par JWT comme le dashboard de supervision.
// Voir en bas de ce fichier comment l'attacher dans server.ts, à côté de
// attachCallsWebSocketServer.

import { WebSocket } from "ws";
import prisma from "../../config/db";
import { hashForIndex } from "../../utils/encryption";
import { createStreamingRecognition } from "./sttService";
import { synthesizeSpeech, encodeAudioForTwilio } from "./ttsService";
import { detectLanguage, resolveLanguageSwitch } from "./languageDetector";
import { registerCall, unregisterCall, isTakenOver } from "./liveCallRegistry";
import { SupportedLanguage, VoiceCallState } from "../types/call.types";
import {
  notifyCallStarted,
  notifyCallTranscript,
  notifyCallEnded,
} from "../../wsCallsServer";

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
 * Gère une connexion WebSocket Twilio Media Stream de bout en bout.
 * `callerPhone` est passé en paramètre personnalisé Twilio (voir twilioWebhook.ts)
 * pour pouvoir relier l'appel à un patient existant dès le départ.
 */
export function handleTwilioMediaStream(ws: WebSocket) {
  let session: StreamSession | null = null;

  ws.on("message", async (raw: string) => {
    const msg = JSON.parse(raw);

    switch (msg.event) {
      case "start": {
        const callId = msg.start.callSid;
        const callerPhone: string | undefined =
          msg.start.customParameters?.callerPhone;
        const initialLanguage = SupportedLanguage.FRENCH;

        // Tentative de résolution du patient par numéro de téléphone,
        // pour afficher son nom dans le dashboard de supervision.
        // NB: le champ indexé est phoneHash (le numéro brut est chiffré,
        // jamais stocké/interrogé en clair) — voir utils/encryption.ts.
        const patient = callerPhone
          ? await prisma.patient.findUnique({
              where: { phoneHash: hashForIndex(callerPhone) },
            })
          : null;

        session = {
          callId,
          isBotSpeaking: false,
          state: {
            callId,
            currentIntent: undefined as any,
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

        // Notifie le dashboard de supervision qu'un appel démarre
        notifyCallStarted(callId, {
          firstName: patient?.firstName,
          lastName: patient?.lastName,
          phone: callerPhone,
        });

        // Enregistre cet appel pour permettre la reprise en direct par une secrétaire
        registerCall({
          callId,
          language: initialLanguage,
          isTakenOver: false,
          sendAgentReply: async (text: string) => {
            await speakToPatient(ws, session!, text);
            notifyCallTranscript(callId, "AGENT", text);
          },
        });
        break;
      }

      case "media": {
        if (!session) return;
        const audioChunk = Buffer.from(msg.media.payload, "base64");

        // Interruption naturelle : coupe l'audio du bot si le patient parle par-dessus
        if (session.isBotSpeaking) {
          ws.send(JSON.stringify({ event: "clear", streamSid: msg.streamSid }));
          session.isBotSpeaking = false;
        }

        session.stt.write(audioChunk);
        break;
      }

      case "stop": {
        if (session) {
          notifyCallEnded(session.callId);
          unregisterCall(session.callId);
          session.stt.end();
        }
        session = null;
        break;
      }
    }
  });

  ws.on("close", () => {
    if (session) {
      notifyCallEnded(session.callId);
      unregisterCall(session.callId);
      session.stt.end();
    }
  });
}

/**
 * Appelé à chaque transcript final reçu du STT.
 * Si l'appel a été repris par une secrétaire (isTakenOver), l'IA ne répond
 * plus automatiquement — elle continue juste à transcrire pour le dashboard.
 */
async function onTranscript(
  ws: WebSocket,
  session: StreamSession,
  transcript: string,
  isFinal: boolean
) {
  if (!isFinal) return;

  session.state.history.push({
    role: "patient",
    message: transcript,
    timestamp: new Date().toISOString(),
  });
  notifyCallTranscript(session.callId, "PATIENT", transcript);

  // Détection/résolution de la langue
  const detection = await detectLanguage(transcript);
  const { language, shouldLock } = resolveLanguageSwitch(
    session.state.language,
    session.state.languageLocked,
    detection
  );
  session.state.language = language;
  session.state.languageLocked = shouldLock;

  // Si une secrétaire a repris l'appel, l'IA se tait et laisse la main
  if (isTakenOver(session.callId)) {
    return;
  }

  // 2. Génération de la réponse (à remplacer par le pipeline NLU complet)
  const replyText = await generateReply(transcript, language);

  session.state.history.push({
    role: "ia",
    message: replyText,
    timestamp: new Date().toISOString(),
  });
  notifyCallTranscript(session.callId, "AI", replyText);

  await speakToPatient(ws, session, replyText);
}

/**
 * Synthétise un texte en audio et l'envoie dans le flux Twilio de la session donnée.
 * Utilisé à la fois par la réponse automatique de l'IA et par les messages
 * tapés en direct par une secrétaire (via liveCallRegistry.sendAgentReply).
 */
async function speakToPatient(
  ws: WebSocket,
  session: StreamSession,
  text: string
) {
  const audioBuffer = await synthesizeSpeech(text, session.state.language);
  session.isBotSpeaking = true;

  ws.send(
    JSON.stringify({
      event: "media",
      media: { payload: encodeAudioForTwilio(audioBuffer) },
    })
  );
}

/*
--- Câblage dans ton server.ts, à côté de attachCallsWebSocketServer(server) ---

import { WebSocketServer } from "ws";
import { handleTwilioMediaStream } from "./ai/voice/twilioMediaStreamHandler";

const twilioWss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/voice/media-stream") {
    twilioWss.handleUpgrade(req, socket, head, (ws) => {
      twilioWss.emit("connection", ws);
    });
  }
  // NB: ne pas faire de `return` bloquant ici si wsCallsServer.ts a aussi
  // son propre listener "upgrade" sur /ws/calls — les deux listeners
  // s'exécutent l'un après l'autre, chacun vérifie son propre pathname.
});

twilioWss.on("connection", handleTwilioMediaStream);
*/