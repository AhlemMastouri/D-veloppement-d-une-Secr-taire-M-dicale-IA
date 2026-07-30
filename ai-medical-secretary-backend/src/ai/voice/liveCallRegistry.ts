
// src/ai/voice/liveCallRegistry.ts
//
// Fait le pont entre le flux audio Twilio (twilioMediaStreamHandler.ts) et
// le WebSocket de supervision (wsCallsServer.ts) utilisé par le dashboard
// secrétaires/médecins.
//
// - Quand un appel Twilio démarre, on l'enregistre ici avec une fonction
//   `sendAgentReply` qui sait comment injecter du texte (converti en audio)
//   dans CE flux Twilio précis.
// - Quand une secrétaire clique "reprendre l'appel" dans le dashboard,
//   wsCallsServer.ts appelle `markTakenOver(callId, true)` : l'IA arrête
//   alors de répondre automatiquement sur cet appel.
// - Quand la secrétaire tape un message dans le dashboard, wsCallsServer.ts
//   appelle `getCall(callId)?.sendAgentReply(text)` pour que ce texte soit
//   prononcé au patient en direct.

import { SupportedLanguage } from "../types/call.types";

export interface RegisteredCall {
  callId: string;
  language: SupportedLanguage;
  isTakenOver: boolean;
  /** Convertit le texte en audio et l'envoie dans le flux Twilio de cet appel précis */
  sendAgentReply: (text: string) => Promise<void>;
}

const registry = new Map<string, RegisteredCall>();

export function registerCall(call: RegisteredCall) {
  registry.set(call.callId, call);
}

export function unregisterCall(callId: string) {
  registry.delete(callId);
}

export function getCall(callId: string): RegisteredCall | undefined {
  return registry.get(callId);
}

export function markTakenOver(callId: string, takenOver: boolean) {
  const call = registry.get(callId);
  if (call) call.isTakenOver = takenOver;
}

export function isTakenOver(callId: string): boolean {
  return registry.get(callId)?.isTakenOver ?? false;
}