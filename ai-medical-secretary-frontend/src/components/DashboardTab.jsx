import React, { useState, useEffect } from 'react';
import { Phone, Clock, ShieldAlert, Award, Coffee, Play, AlertCircle, PhoneOff, UserCheck, RefreshCw } from 'lucide-react';

export default function DashboardTab({ token }) {
  const [stats, setStats] = useState({
    totalCalls: 3,
    missedCalls: 0,
    averageDurationSeconds: 87,
    appointmentsTaken: 3,
    cancellationRatePercent: 0,
    timeSavedMinutes: 7.5,
    patientSatisfactionScore: 4.8
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // Live call simulation state
  const [activeCall, setActiveCall] = useState(null); // null or { phone, type, transcript: [], status: 'ringing'|'active'|'ended' }
  const [simStep, setSimStep] = useState(0);
  const [simIntervalId, setSimIntervalId] = useState(null);

  // Fetch stats from backend
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('http://localhost:3000/api/v1/calls/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Erreur stats API:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  // Simulated conversations
  const simulations = {
    booking: {
      phone: '+33 6 12 34 56 78',
      type: 'PRIS DE RENDEZ-VOUS',
      classification: 'APPOINTMENT_BOOKING',
      dialogue: [
        { sender: 'AI', text: 'Bonjour, Secrétariat Médical IA. Comment puis-je vous aider ?' },
        { sender: 'PATIENT', text: 'Bonjour, je voudrais réserver un rendez-vous avec le Dr. Dupont pour demain s\'il vous plaît.' },
        { sender: 'AI', text: 'Bien sûr ! J\'analyse vos coordonnées... Vous êtes Alice Dubois. Le créneau de 15h00 est libre demain. Cela vous convient-il ?' },
        { sender: 'PATIENT', text: 'Oui, 15h00 c\'est parfait.' },
        { sender: 'AI', text: 'Parfait, le rendez-vous est confirmé pour le 21 juillet à 15h00. Un SMS de confirmation vient de vous être envoyé. Autre chose ?' },
        { sender: 'PATIENT', text: 'Non merci, bonne journée !' },
        { sender: 'AI', text: 'Merci à vous, prenez soin de vous. Au revoir.' }
      ]
    },
    emergency: {
      phone: '+33 6 99 99 99 99',
      type: 'URGENCE CRITIQUE',
      classification: 'EMERGENCY',
      dialogue: [
        { sender: 'AI', text: 'Bonjour, Secrétariat Médical IA. Comment puis-je vous aider ?' },
        { sender: 'PATIENT', text: 'Bonjour... J\'ai une douleur affreuse dans la poitrine depuis 10 minutes, j\'ai très mal au bras gauche aussi...' },
        { sender: 'AI', text: '⚠️ [Alerte Urgence] Restez calme. Vos symptômes évoquent un risque cardiaque sérieux. Je transfère IMMÉDIATEMENT votre appel à notre secrétaire médicale de garde et en parallèle je vous invite à composer le 15 (SAMU) s\'il y a la moindre attente.' },
        { sender: 'SYSTEM', text: '🔔 Transfert d\'appel d\'urgence vers la secrétaire Marie Martin en cours...' }
      ]
    },
    info: {
      phone: '+33 7 55 55 55 55',
      type: 'DEMANDE D\'INFORMATION',
      classification: 'INFO_REQUEST',
      dialogue: [
        { sender: 'AI', text: 'Bonjour, Secrétariat Médical IA. En quoi puis-je vous aider ?' },
        { sender: 'PATIENT', text: 'Bonjour, je viens en voiture demain. Y a-t-il une place pour se garer près du cabinet ?' },
        { sender: 'AI', text: 'Oui, tout à fait. Le parking public Indigo "Place de la Concorde" est situé à 5 minutes de marche du cabinet.' },
        { sender: 'PATIENT', text: 'Super, merci pour l\'information. Et pour payer la consultation, vous prenez les chèques ?' },
        { sender: 'AI', text: 'Oui, nous acceptons les cartes bancaires, les espèces et les chèques. Nous prenons également la carte Vitale pour le tiers payant.' },
        { sender: 'PATIENT', text: 'D\'accord, merci beaucoup. Bonne journée.' }
      ]
    }
  };

  const startSimulation = (simKey) => {
    // Clear any active simulations first
    if (simIntervalId) {
      clearInterval(simIntervalId);
    }

    const simData = simulations[simKey];
    setActiveCall({
      phone: simData.phone,
      type: simData.type,
      classification: simData.classification,
      transcript: [],
      status: 'ringing'
    });
    setSimStep(0);

    // After 1.5 seconds, start the call
    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'active', transcript: [simData.dialogue[0]] } : null);
      
      let currentStep = 1;
      const interval = setInterval(() => {
        if (currentStep < simData.dialogue.length) {
          setActiveCall(prev => {
            if (!prev) return null;
            return {
              ...prev,
              transcript: [...prev.transcript, simData.dialogue[currentStep]]
            };
          });
          currentStep++;
        } else {
          clearInterval(interval);
          setActiveCall(prev => prev ? { ...prev, status: 'ended' } : null);
          // Auto log the call in backend
          logCallToBackend(simData);
        }
      }, 2500);

      setSimIntervalId(interval);
    }, 1500);
  };

  const logCallToBackend = async (simData) => {
    try {
      await fetch('http://localhost:3000/api/v1/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: 'INBOUND',
          phoneNumber: simData.phone,
          status: 'COMPLETED',
          duration: simData.dialogue.length * 15,
          transcript: JSON.stringify(simData.dialogue),
          summary: `Appel simulé de type ${simData.type}. Répondu par l'IA.`,
          classification: simData.classification,
          language: 'Français'
        })
      });
      // Refresh statistics after adding call
      fetchStats();
    } catch (e) {
      console.error('Erreur enregistrement appel:', e);
    }
  };

  const stopCall = () => {
    if (simIntervalId) {
      clearInterval(simIntervalId);
    }
    setActiveCall(prev => prev ? { ...prev, status: 'ended' } : null);
    setTimeout(() => setActiveCall(null), 1000);
  };

  const takeOverCall = () => {
    if (simIntervalId) {
      clearInterval(simIntervalId);
    }
    setActiveCall(prev => prev ? { 
      ...prev, 
      status: 'ended',
      transcript: [...prev.transcript, { sender: 'SYSTEM', text: '👤 La secrétaire Marie Martin a repris l\'appel en direct.' }]
    } : null);
    
    // Increment stats mock or server log
    fetchStats();
  };

  return (
    <div className="animate-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Tableau de bord</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Statistiques opérationnelles et simulation d'appels en temps réel</p>
        </div>
        <button 
          className="btn btn-outline" 
          onClick={fetchStats} 
          disabled={loadingStats}
          style={{ display: 'flex', gap: '8px' }}
        >
          <RefreshCw size={16} className={loadingStats ? 'pulse-active' : ''} />
          Rafraîchir
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
            <Phone size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Appels gérés</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.totalCalls}</span>
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: 'var(--danger)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Appels manqués</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.missedCalls}</span>
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--secondary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Durée moyenne</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.averageDurationSeconds}s</span>
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--success)' }}>
            <Coffee size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Temps médecin gagné</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.timeSavedMinutes}m</span>
          </div>
        </div>

        <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '12px', color: 'var(--warning)' }}>
            <Award size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Satisfaction</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.patientSatisfactionScore}/5</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: activeCall ? '1fr 1fr' : '1fr', gap: '30px', transition: 'all 0.3s' }}>
        
        {/* Simulation Triggers Panel */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Play size={20} color="var(--primary)" />
            Simulateur d'appels entrants (Patient IA)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Sélectionnez un scénario d'appel ci-dessous pour lancer une simulation de conversation vocale automatique. L'IA traitera l'appel et l'enregistrera dans le journal du cabinet.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn btn-outline" 
              style={{ justifyContent: 'space-between', padding: '16px', textAlign: 'left' }}
              onClick={() => startSimulation('booking')}
              disabled={activeCall && activeCall.status !== 'ended'}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>1. Prise de rendez-vous</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alice Dubois appelle pour réserver pour demain après-midi.</span>
              </div>
              <span className="badge badge-primary">Rendez-vous</span>
            </button>

            <button 
              className="btn btn-outline" 
              style={{ justifyContent: 'space-between', padding: '16px', textAlign: 'left', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={() => startSimulation('emergency')}
              disabled={activeCall && activeCall.status !== 'ended'}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--danger)' }}>2. Urgence critique cardiaque</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Patient décrivant une douleur thoracique intense.</span>
              </div>
              <span className="badge badge-danger">Urgence</span>
            </button>

            <button 
              className="btn btn-outline" 
              style={{ justifyContent: 'space-between', padding: '16px', textAlign: 'left' }}
              onClick={() => startSimulation('info')}
              disabled={activeCall && activeCall.status !== 'ended'}
            >
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>3. Demande de renseignements généraux</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Question sur le stationnement et les modes de paiement.</span>
              </div>
              <span className="badge badge-warning font-sans">FAQ</span>
            </button>
          </div>
        </div>

        {/* Live Call Simulator Transcription View */}
        {activeCall && (
          <div className="glass-card animate-slide-in" style={{ borderColor: activeCall.classification === 'EMERGENCY' ? 'var(--danger)' : 'var(--border-color)', display: 'flex', flexDirection: 'column', height: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
              <div>
                <span className="pulse-active" style={{ height: '8px', width: '8px', borderRadius: '50%', background: activeCall.classification === 'EMERGENCY' ? 'var(--danger)' : 'var(--success)', display: 'inline-block', marginRight: '8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {activeCall.status === 'ringing' ? 'SONNERIE EN COURS...' : activeCall.status === 'ended' ? 'APPEL TERMINÉ' : 'APPEL EN DIRECT...'}
                </span>
                <h4 style={{ fontSize: '1.05rem', marginTop: '4px' }}>{activeCall.phone}</h4>
              </div>
              <div>
                <span className={`badge ${activeCall.classification === 'EMERGENCY' ? 'badge-danger' : activeCall.classification === 'APPOINTMENT_BOOKING' ? 'badge-primary' : 'badge-warning'}`}>
                  {activeCall.type}
                </span>
              </div>
            </div>

            {/* Conversation text scrolling */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginBottom: '16px' }}>
              {activeCall.status === 'ringing' && (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <Phone size={24} className="pulse-active" style={{ marginRight: '10px' }} />
                  Connexion vocale établie...
                </div>
              )}
              {activeCall.transcript.map((bubble, i) => (
                <div 
                  key={i} 
                  style={{
                    alignSelf: bubble.sender === 'AI' ? 'flex-start' : bubble.sender === 'SYSTEM' ? 'center' : 'flex-end',
                    maxWidth: '85%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    background: bubble.sender === 'AI' 
                      ? 'var(--bg-sidebar)' 
                      : bubble.sender === 'SYSTEM'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(14, 165, 233, 0.15)',
                    border: bubble.sender === 'SYSTEM' ? '1px dashed var(--warning)' : '1px solid var(--border-color)',
                    color: bubble.sender === 'SYSTEM' ? 'var(--warning)' : 'var(--text-primary)'
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '0.7rem', color: bubble.sender === 'AI' ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: '4px' }}>
                    {bubble.sender === 'AI' ? '🎙️ SECRÉTAIRE IA' : bubble.sender === 'SYSTEM' ? '⚠️ SYSTÈME' : '👤 PATIENT'}
                  </strong>
                  {bubble.text}
                </div>
              ))}
            </div>

            {/* Action Buttons inside call view */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {activeCall.status === 'active' && activeCall.classification === 'EMERGENCY' && (
                <button 
                  className="btn btn-danger" 
                  onClick={takeOverCall}
                  style={{ flex: 1, padding: '12px' }}
                >
                  <UserCheck size={18} />
                  Prendre le contrôle
                </button>
              )}
              <button 
                className="btn btn-outline" 
                onClick={stopCall}
                style={{ flex: activeCall.classification === 'EMERGENCY' ? 0.3 : 1, padding: '12px' }}
              >
                <PhoneOff size={18} />
                Raccrocher
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
