import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall, Phone, PhoneIncoming, Radio, Send, LogOut as HandOff,
  Edit3, Save, X, AlertTriangle, ShieldAlert, User, Clock, CheckCircle,
  MessageSquare, Siren, ClipboardList
} from 'lucide-react';
import TasksTab from './TasksTab';

// ─── Convention WebSocket attendue par ce composant (à adapter à ton backend) ───
// Connexion : ws://localhost:3001/ws/calls?token=<JWT>
// Messages reçus (serveur -> client), JSON :
//   { type: 'call_started', callId, patient: {firstName,lastName,phone}, startedAt }
//   { type: 'call_transcript', callId, speaker: 'AI'|'PATIENT'|'AGENT', text, timestamp }
//   { type: 'call_ended', callId }
//   { type: 'live_calls_snapshot', calls: [...] }        // envoyé à la connexion
//   { type: 'takeover_ack', callId, by }                 // confirmation de prise en charge
//   { type: 'takeover_denied', callId, reason }           // refus (déjà pris par quelqu'un d'autre)
//   { type: 'release_ack', callId }                       // confirmation de rendu à l'IA
// Messages envoyés (client -> serveur), JSON :
//   { type: 'takeover', callId }            // la secrétaire prend le relais
//   { type: 'release', callId }             // rendre le contrôle à l'IA
//   { type: 'agent_message', callId, text } // message envoyé par la secrétaire pendant le relais

const WS_URL = (token) => `ws://localhost:3001/ws/calls?token=${encodeURIComponent(token)}`;

export default function SecretaryDashboard({ token }) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('conversations');
  const [error, setError] = useState('');

  // ─── WebSocket partagé (appels en direct) ───
  const wsRef = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const [liveCalls, setLiveCalls] = useState([]); // [{callId, patient, startedAt, takenOverBy}]
  const [transcripts, setTranscripts] = useState({}); // { [callId]: [{speaker, text, timestamp}] }
  const [activeCallId, setActiveCallId] = useState(null); // appel actuellement repris par cette secrétaire
  const [agentMessage, setAgentMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    let ws;
    let reconnectTimer;

    const connect = () => {
      setWsStatus('connecting');
      ws = new WebSocket(WS_URL(token));
      wsRef.current = ws;

      ws.onopen = () => setWsStatus('connected');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'live_calls_snapshot') {
            setLiveCalls(msg.calls || []);
          } else if (msg.type === 'call_started') {
            setLiveCalls(prev => [...prev.filter(c => c.callId !== msg.callId), {
              callId: msg.callId, patient: msg.patient, startedAt: msg.startedAt, takenOverBy: null
            }]);
          } else if (msg.type === 'call_transcript') {
            setTranscripts(prev => ({
              ...prev,
              [msg.callId]: [...(prev[msg.callId] || []), { speaker: msg.speaker, text: msg.text, timestamp: msg.timestamp }]
            }));
          } else if (msg.type === 'call_ended') {
            setLiveCalls(prev => prev.filter(c => c.callId !== msg.callId));
            setActiveCallId(prev => (prev === msg.callId ? null : prev));
          } else if (msg.type === 'takeover_ack') {
            // Confirmation serveur : on marque l'appel comme pris en charge.
            setLiveCalls(prev => prev.map(c => c.callId === msg.callId ? { ...c, takenOverBy: msg.by || 'moi' } : c));
            setActiveCallId(msg.callId);
          } else if (msg.type === 'takeover_denied') {
            // Un autre agent a déjà pris l'appel : on annule notre tentative optimiste.
            setError(msg.reason || 'Cet appel a déjà été pris en charge par une autre personne.');
            setActiveCallId(prev => (prev === msg.callId ? null : prev));
          } else if (msg.type === 'release_ack') {
            // Confirmation serveur : l'appel est rendu à l'IA, on réinitialise takenOverBy.
            setLiveCalls(prev => prev.map(c => c.callId === msg.callId ? { ...c, takenOverBy: null } : c));
            setActiveCallId(prev => (prev === msg.callId ? null : prev));
          }
        } catch (e) {
          console.error('Message WS invalide :', e);
        }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000); // reconnexion automatique
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token]);

  const sendWs = (payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      setError("Connexion en direct indisponible, veuillez patienter...");
    }
  };

  const takeoverCall = (callId) => {
    sendWs({ type: 'takeover', callId });
    // Mise à jour optimiste ; sera confirmée par 'takeover_ack' ou annulée par 'takeover_denied'.
    setLiveCalls(prev => prev.map(c => c.callId === callId ? { ...c, takenOverBy: 'moi' } : c));
    setActiveCallId(callId);
  };

  const releaseCall = (callId) => {
    sendWs({ type: 'release', callId });
    // Mise à jour optimiste ; sera confirmée par 'release_ack'.
    setLiveCalls(prev => prev.map(c => c.callId === callId ? { ...c, takenOverBy: null } : c));
    if (activeCallId === callId) setActiveCallId(null);
  };

  const sendAgentMessage = (e) => {
    e.preventDefault();
    if (!agentMessage.trim() || !activeCallId) return;
    sendWs({ type: 'agent_message', callId: activeCallId, text: agentMessage.trim() });
    setTranscripts(prev => ({
      ...prev,
      [activeCallId]: [...(prev[activeCallId] || []), { speaker: 'AGENT', text: agentMessage.trim(), timestamp: new Date().toISOString() }]
    }));
    setAgentMessage('');
  };

  // ─── Conversations (historique des appels IA) ───
  const [callLogs, setCallLogs] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState('');

  const fetchCallLogs = async () => {
    setLoadingCalls(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (classificationFilter) params.append('classification', classificationFilter);
      const res = await fetch(`http://localhost:3001/api/v1/calls?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCallLogs(data.calls || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des conversations');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingCalls(false);
    }
  };

  // ─── Corriger les réponses IA ───
  const [editingLogId, setEditingLogId] = useState(null);
  const [editForm, setEditForm] = useState({ summary: '', classification: 'APPOINTMENT_BOOKING' });
  const [savingCorrection, setSavingCorrection] = useState(false);

  const openCorrection = (log) => {
    setEditingLogId(log.id);
    setEditForm({ summary: log.summary || '', classification: log.classification || 'APPOINTMENT_BOOKING' });
  };

  const cancelCorrection = () => {
    setEditingLogId(null);
    setEditForm({ summary: '', classification: 'APPOINTMENT_BOOKING' });
  };

  const saveCorrection = async (id) => {
    setSavingCorrection(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/v1/calls/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        cancelCorrection();
        fetchCallLogs();
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la correction');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de la correction');
    } finally {
      setSavingCorrection(false);
    }
  };

  // ─── Gérer les urgences ───
  const emergencyLogs = callLogs.filter(l => l.classification === 'EMERGENCY');

  const markEmergencyHandled = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/calls/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emergencyHandled: true })
      });
      if (res.ok) {
        fetchCallLogs();
      } else {
        const data = await res.json();
        setError(data.error || 'Impossible de marquer cette urgence comme traitée');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    }
  };

  useEffect(() => {
    if (activeTab === 'conversations' || activeTab === 'corrections' || activeTab === 'emergencies') {
      fetchCallLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, classificationFilter]);

  const classificationBadge = (cls) => {
    const map = {
      EMERGENCY: { cls: 'badge-danger', label: 'Urgence' },
      APPOINTMENT_BOOKING: { cls: 'badge-primary', label: 'Prise de RDV' },
      INFO_REQUEST: { cls: 'badge-warning', label: 'Demande d\'info' },
    };
    return map[cls] || { cls: 'badge-warning', label: cls || 'Inconnu' };
  };

  const wsStatusInfo = {
    connected: { color: 'var(--success)', label: 'En direct' },
    connecting: { color: 'var(--warning, #f59e0b)', label: 'Connexion...' },
    disconnected: { color: 'var(--danger)', label: 'Déconnecté' },
  }[wsStatus];

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Espace Secrétaire</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Supervision des conversations IA, appels en direct et gestion des urgences
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: wsStatusInfo.color, fontWeight: 600 }}>
          <Radio size={14} /> {wsStatusInfo.label}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'conversations', label: 'Conversations', icon: <MessageSquare size={16} /> },
          { id: 'live', label: 'Appels en direct', icon: <PhoneIncoming size={16} />, badge: liveCalls.length },
          { id: 'corrections', label: 'Corriger les réponses IA', icon: <Edit3 size={16} /> },
          { id: 'emergencies', label: 'Urgences', icon: <Siren size={16} />, badge: emergencyLogs.filter(l => !l.emergencyHandled).length },
          { id: 'tasks', label: 'Mes tâches', icon: <ClipboardList size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            className="btn"
            style={{
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
              borderRadius: 0,
              padding: '10px 16px',
              fontSize: '0.9rem',
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
            {!!tab.badge && (
              <span style={{
                background: tab.id === 'emergencies' ? 'var(--danger)' : 'var(--primary)',
                color: 'white', borderRadius: '999px', fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: 'var(--danger)',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginBottom: '16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertTriangle size={16} />
            {error}
          </span>
          <button
            onClick={() => setError('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── CONVERSATIONS ─── */}
      {activeTab === 'conversations' && (
        <div>
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filtrer :</span>
            {[
              { val: '', label: 'Toutes' },
              { val: 'EMERGENCY', label: 'Urgences' },
              { val: 'APPOINTMENT_BOOKING', label: 'Prise de RDV' },
              { val: 'INFO_REQUEST', label: 'Demandes d\'info' },
            ].map(f => (
              <button
                key={f.val}
                className="btn btn-outline"
                style={{
                  padding: '6px 14px', fontSize: '0.8rem',
                  background: classificationFilter === f.val ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                  borderColor: classificationFilter === f.val ? 'var(--primary)' : 'var(--border-color)',
                  color: classificationFilter === f.val ? 'var(--primary)' : 'var(--text-secondary)'
                }}
                onClick={() => setClassificationFilter(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            {loadingCalls ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
            ) : callLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                Aucune conversation enregistrée.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {callLogs.map((log) => {
                  const badge = classificationBadge(log.classification);
                  return (
                    <div key={log.id} style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.25)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                          <Phone size={14} color="var(--text-secondary)" />
                          {new Date(log.startTime).toLocaleString('fr-FR')} ({log.duration}s)
                        </span>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {log.patient && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Patient : {log.patient.firstName} {log.patient.lastName}
                          {log.doctor && ` — Dr. ${log.doctor.name}`}
                        </span>
                      )}
                      <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Résumé IA :</strong>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.summary || 'Pas de résumé'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── APPELS EN DIRECT ─── */}
      {activeTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: activeCallId ? '320px 1fr' : '1fr', gap: '20px' }}>
          {/* Liste des appels en cours */}
          <div className="glass-card" style={{ padding: '18px', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneIncoming size={18} color="var(--primary)" /> Appels en cours ({liveCalls.length})
            </h3>
            {liveCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.85rem' }}>
                Aucun appel IA en cours actuellement.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {liveCalls.map((call) => (
                  <div
                    key={call.callId}
                    style={{
                      padding: '12px', borderRadius: '10px',
                      background: activeCallId === call.callId ? 'rgba(14, 165, 233, 0.12)' : 'rgba(30, 41, 59, 0.25)',
                      border: `1px solid ${activeCallId === call.callId ? 'var(--primary)' : 'var(--border-color)'}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <User size={14} color="var(--text-secondary)" />
                      <strong style={{ fontSize: '0.85rem' }}>{call.patient?.firstName} {call.patient?.lastName || 'Appelant inconnu'}</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                      <Clock size={11} /> Démarré à {new Date(call.startedAt).toLocaleTimeString('fr-FR')}
                    </span>
                    {call.takenOverBy ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--warning, #f59e0b)', flex: 1 }}>Pris en charge par {call.takenOverBy}</span>
                        {activeCallId === call.callId && (
                          <button className="btn btn-outline" style={{ padding: '5px 8px', fontSize: '0.72rem' }} onClick={() => releaseCall(call.callId)}>
                            <HandOff size={12} /> Rendre à l'IA
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '7px', fontSize: '0.78rem' }}
                        onClick={() => takeoverCall(call.callId)}
                      >
                        <PhoneCall size={14} /> Prendre le relais
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panneau de conversation en direct */}
          {activeCallId && (
            <div className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', height: '560px' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '12px' }}>Conversation en direct</h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', marginBottom: '14px' }}>
                {(transcripts[activeCallId] || []).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '40px' }}>
                    En attente de la transcription...
                  </div>
                ) : (
                  transcripts[activeCallId].map((line, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: line.speaker === 'PATIENT' ? 'flex-start' : 'flex-end',
                        maxWidth: '75%',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        background: line.speaker === 'PATIENT'
                          ? 'rgba(255,255,255,0.06)'
                          : line.speaker === 'AGENT'
                            ? 'rgba(14, 165, 233, 0.18)'
                            : 'rgba(99, 102, 241, 0.15)'
                      }}
                    >
                      <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        {line.speaker === 'PATIENT' ? 'Patient' : line.speaker === 'AGENT' ? 'Vous (secrétaire)' : 'IA'}
                      </span>
                      {line.text}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendAgentMessage} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Écrire un message au patient..."
                  value={agentMessage}
                  onChange={(e) => setAgentMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ─── CORRIGER LES RÉPONSES IA ─── */}
      {activeTab === 'corrections' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {loadingCalls ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
          ) : callLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucune conversation à corriger.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {callLogs.map((log) => {
                const badge = classificationBadge(log.classification);
                const isEditing = editingLogId === log.id;
                return (
                  <div key={log.id} style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.25)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {new Date(log.startTime).toLocaleString('fr-FR')} — {log.patient?.firstName} {log.patient?.lastName}
                      </span>
                      {!isEditing && <span className={`badge ${badge.cls}`}>{badge.label}</span>}
                    </div>

                    {isEditing ? (
                      <div>
                        <div className="form-group">
                          <label className="form-label">Classification</label>
                          <select
                            className="form-control"
                            value={editForm.classification}
                            onChange={(e) => setEditForm({ ...editForm, classification: e.target.value })}
                          >
                            <option value="APPOINTMENT_BOOKING">Prise de RDV</option>
                            <option value="INFO_REQUEST">Demande d'info</option>
                            <option value="EMERGENCY">Urgence</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Résumé corrigé</label>
                          <textarea
                            className="form-control"
                            rows={3}
                            value={editForm.summary}
                            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                            onClick={() => saveCorrection(log.id)}
                            disabled={savingCorrection}
                          >
                            <Save size={14} /> {savingCorrection ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                          <button className="btn btn-outline" style={{ padding: '7px 14px', fontSize: '0.82rem' }} onClick={cancelCorrection}>
                            <X size={14} /> Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1, minWidth: '200px' }}>
                          {log.summary || 'Pas de résumé'}
                        </p>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--primary)', borderColor: 'rgba(14, 165, 233, 0.3)' }}
                          onClick={() => openCorrection(log)}
                        >
                          <Edit3 size={14} /> Corriger
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── GÉRER LES URGENCES ─── */}
      {activeTab === 'emergencies' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {loadingCalls ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
          ) : emergencyLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucune urgence détectée récemment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {emergencyLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '16px',
                    background: log.emergencyHandled ? 'rgba(30, 41, 59, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${log.emergencyHandled ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.35)'}`,
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, color: log.emergencyHandled ? 'var(--text-primary, #fff)' : 'var(--danger)' }}>
                      <ShieldAlert size={16} /> {new Date(log.startTime).toLocaleString('fr-FR')}
                    </span>
                    {log.emergencyHandled ? (
                      <span className="badge badge-success" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <CheckCircle size={12} /> Traitée
                      </span>
                    ) : (
                      <span className="badge badge-danger">Non traitée</span>
                    )}
                  </div>
                  {log.patient && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '8px', fontSize: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color="var(--text-secondary)" /> {log.patient.firstName} {log.patient.lastName}
                      </span>
                      {log.patient.phone && (
                        <a href={`tel:${log.patient.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', textDecoration: 'none' }}>
                          <Phone size={14} /> {log.patient.phone}
                        </a>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {log.summary || 'Pas de résumé disponible.'}
                  </p>
                  {!log.emergencyHandled && (
                    <button
                      className="btn btn-outline"
                      style={{ padding: '7px 14px', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                      onClick={() => markEmergencyHandled(log.id)}
                    >
                      <CheckCircle size={14} /> Marquer comme traitée
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MES TÂCHES (indépendantes — visibles uniquement par Secrétaire) ─── */}
      {activeTab === 'tasks' && (
        <TasksTab token={token} role="SECRETARY" currentUser={currentUser} />
      )}
    </div>
  );
}