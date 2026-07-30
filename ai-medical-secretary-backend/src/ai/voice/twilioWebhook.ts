// src/ai/voice/twilioWebhook.ts
//
// Route Express appelée par Twilio dès qu'un appel entrant arrive sur ton numéro.
// À enregistrer dans ton app Express : app.post("/voice/incoming", handleIncomingCall)
// Et à configurer comme webhook "A CALL COMES IN" dans la console Twilio.

import { Request, Response } from "express";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Répond à un appel entrant en ouvrant un flux audio bidirectionnel (Media Stream)
 * vers notre serveur WebSocket, qui gère ensuite tout le dialogue vocal.
 */
export function handleIncomingCall(req: Request, res: Response) {
  const response = new VoiceResponse();
  const callerPhone = req.body.From ?? "";

  const connect = response.connect();
  const stream = connect.stream({
    // WSS_URL doit pointer vers ton serveur WebSocket (voir twilioMediaStreamHandler.ts)
    // ex: wss://ton-domaine.com/voice/media-stream
    url: process.env.TWILIO_MEDIA_STREAM_URL ?? "",
  });
  // Transmis dans l'événement "start" du Media Stream (msg.start.customParameters.callerPhone)
  stream.parameter({ name: "callerPhone", value: callerPhone });

  res.type("text/xml");
  res.send(response.toString());
}