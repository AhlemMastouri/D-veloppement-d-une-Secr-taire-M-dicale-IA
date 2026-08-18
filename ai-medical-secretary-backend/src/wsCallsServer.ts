import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { Server as HttpServer } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';

// ─── Types ───────────────────────────────────────────────────────────────

interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface LiveCall {
  callId: string;
  patient?: { firstName?: string; lastName?: string; phone?: string };
  startedAt: string;
  takenOverBy: string | null;
  takenOverByUserId: number | null;
}

interface ClientInfo {
  ws: WebSocket;
  user: AuthenticatedUser;
}

// ─── État en mémoire ─────────────────────────────────────────────────────
// NB: en mémoire process — si tu passes en multi-instance (cluster / plusieurs
// dynos), il faudra migrer cet état vers Redis (pub/sub) pour rester cohérent
// entre instances.

const liveCalls = new Map<string, LiveCall>();
const clients = new Set<ClientInfo>();

// ─── Auth JWT (même secret que authMiddleware.ts) ───────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'medical-secretary-super-secret-key-123!';

function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
  } catch (e) {
    return null;
  }
}

// ─── Diffusion ───────────────────────────────────────────────────────────

function broadcast(payload: object, exclude?: WebSocket) {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN && client.ws !== exclude) {
      client.ws.send(data);
    }
  }
}

function sendTo(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// ─── Attache le serveur WS au serveur HTTP Express ──────────────────────

export function attachCallsWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url || '', `http://${req.headers.host}`);

    if (pathname !== '/ws/calls') {
      // Pas notre route : on laisse passer (utile si d'autres WS sont ajoutés plus tard)
      return;
    }

    const token = searchParams.get('token');
    const user = token ? verifyToken(token) : null;

    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Seuls Admin, Secrétaire et Médecin peuvent superviser les appels en direct
    if (!['ADMIN', 'SECRETARY', 'DOCTOR'].includes(user.role)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, user: AuthenticatedUser) => {
    const clientInfo: ClientInfo = { ws, user };
    clients.add(clientInfo);

    // Snapshot initial des appels en cours
    sendTo(ws, {
      type: 'live_calls_snapshot',
      calls: Array.from(liveCalls.values()),
    });

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // message invalide, on ignore silencieusement
      }

      if (msg.type === 'takeover') {
        const call = liveCalls.get(msg.callId);
        if (!call) return;

        if (call.takenOverBy && call.takenOverByUserId !== user.id) {
          // Déjà pris par quelqu'un d'autre
          sendTo(ws, {
            type: 'takeover_denied',
            callId: msg.callId,
            reason: `Cet appel a déjà été pris en charge par ${call.takenOverBy}.`,
          });
          return;
        }

        call.takenOverBy = user.name;
        call.takenOverByUserId = user.id;
        broadcast({ type: 'takeover_ack', callId: msg.callId, by: user.name });
      }

      else if (msg.type === 'release') {
        const call = liveCalls.get(msg.callId);
        if (!call) return;

        // Seul celui qui a pris l'appel (ou un admin) peut le rendre
        if (call.takenOverByUserId !== user.id && user.role !== 'ADMIN') return;

        call.takenOverBy = null;
        call.takenOverByUserId = null;
        broadcast({ type: 'release_ack', callId: msg.callId });
      }

      else if (msg.type === 'agent_message') {
        const call = liveCalls.get(msg.callId);
        if (!call) return;
        if (!msg.text || typeof msg.text !== 'string') return;

        // TODO: brancher ici l'envoi réel du message vers le système de téléphonie/IA
        // qui le transmettra au patient (ex: injection dans le flux TTS en cours).
        broadcast({
          type: 'call_transcript',
          callId: msg.callId,
          speaker: 'AGENT',
          text: msg.text,
          timestamp: new Date().toISOString(),
        });
      }
    });

    ws.on('close', () => {
      clients.delete(clientInfo);
    });

    ws.on('error', () => {
      clients.delete(clientInfo);
    });
  });

  return wss;
}

// ─── API à appeler depuis le reste du backend ───────────────────────────
// (ex: depuis le connecteur téléphonie/IA quand un appel démarre, reçoit une
// transcription, ou se termine)

export function notifyCallStarted(callId: string, patient?: LiveCall['patient']) {
  const call: LiveCall = {
    callId,
    patient,
    startedAt: new Date().toISOString(),
    takenOverBy: null,
    takenOverByUserId: null,
  };
  liveCalls.set(callId, call);
  broadcast({ type: 'call_started', callId, patient, startedAt: call.startedAt });
}

export function notifyCallTranscript(callId: string, speaker: 'AI' | 'PATIENT' | 'AGENT', text: string) {
  if (!liveCalls.has(callId)) return;
  broadcast({ type: 'call_transcript', callId, speaker, text, timestamp: new Date().toISOString() });
}

export function notifyCallEnded(callId: string) {
  liveCalls.delete(callId);
  broadcast({ type: 'call_ended', callId });
}


