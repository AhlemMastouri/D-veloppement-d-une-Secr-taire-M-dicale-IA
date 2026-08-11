import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Plus, Save, Settings, MessageSquare, ShieldAlert, 
  Send, PhoneCall, RefreshCw, Layers, CheckCircle2, AlertTriangle, FileText, Mail, MessageCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

export default function FAQTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('faq'); // 'faq' | 'qualification' | 'messaging'

  // FAQ state
  const [faqs, setFaqs] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('tous');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('horaires');
  
  // Qualification simulator state
  const [qualifyText, setQualifyText] = useState('');
  const [qualifyResult, setQualifyResult] = useState(null);
  const [qualifying, setQualifying] = useState(false);

  // Messaging state
  const [messages, setMessages] = useState([]);
  const [msgPatientId, setMsgPatientId] = useState('1');
  const [msgChannel, setMsgChannel] = useState('SMS');
  const [msgType, setMsgType] = useState('AUTO_REPLY');
  const [msgContent, setMsgContent] = useState('');
  const [msgAttachment, setMsgAttachment] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgSuccess, setMsgSuccess] = useState('');

  const faqCategories = [
    'tous', 'horaires', 'adresse', 'parking', 'specialites', 
    'preparations', 'tarifs', 'paiement', 'examens', 'teleconsultation'
  ];

  const qualificationCategories = [
    { key: 'urgence', label: 'Urgence', color: 'var(--danger)' },
    { key: 'rendez-vous', label: 'Rendez-vous', color: 'var(--primary)' },
    { key: 'devis', label: 'Devis', color: 'var(--warning)' },
    { key: 'informations', label: 'Informations', color: 'var(--secondary)' },
    { key: 'administratif', label: 'Administratif', color: '#8b5cf6' },
    { key: 'laboratoire', label: 'Laboratoire', color: '#ec4899' },
    { key: 'pharmacie', label: 'Pharmacie', color: 'var(--success)' }
  ];

  const fetchFaqs = async () => {
    try {
      const url = categoryFilter !== 'tous' 
        ? `${API_BASE}/faqs?category=${categoryFilter}` 
        : `${API_BASE}/faqs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch (e) {
      console.error('Erreur FAQs:', e);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messaging`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Erreur Messages:', e);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, [categoryFilter]);

  useEffect(() => {
    if (activeSubTab === 'messaging') {
      fetchMessages();
    }
  }, [activeSubTab]);

  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newQuestion || !newAnswer) return;

    try {
      const res = await fetch(`${API_BASE}/faqs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: newQuestion,
          answer: newAnswer,
          category: newCategory
        })
      });

      if (res.ok) {
        setNewQuestion('');
        setNewAnswer('');
        fetchFaqs();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleQualifyTest = async (e) => {
    e.preventDefault();
    if (!qualifyText) return;
    setQualifying(true);
    try {
      const res = await fetch(`${API_BASE}/faqs/qualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: qualifyText })
      });
      if (res.ok) {
        const data = await res.json();
        setQualifyResult(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQualifying(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgContent) return;
    setSendingMsg(true);
    setMsgSuccess('');
    try {
      const res = await fetch(`${API_BASE}/messaging/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: msgPatientId,
          channel: msgChannel,
          type: msgType,
          content: msgContent,
          attachmentUrl: msgAttachment || undefined
        })
      });
      if (res.ok) {
        setMsgContent('');
        setMsgAttachment('');
        setMsgSuccess('Message envoyé avec succès !');
        fetchMessages();
        setTimeout(() => setMsgSuccess(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleBulkReminders = async () => {
    try {
      const res = await fetch(`${API_BASE}/messaging/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ channel: 'SMS', type: 'REMINDER' })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message);
        fetchMessages();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>IA & Support Multicanal</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Questions fréquentes, qualification des appels et messagerie automatisée</p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeSubTab === 'faq' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('faq')}
        >
          <BookOpen size={16} /> 4.6 Questions Fréquentes
        </button>
        <button 
          className={`btn ${activeSubTab === 'qualification' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('qualification')}
        >
          <Layers size={16} /> 4.7 Qualification des Appels
        </button>
        <button 
          className={`btn ${activeSubTab === 'messaging' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('messaging')}
        >
          <MessageSquare size={16} /> 4.8 Messagerie Multicanal
        </button>
      </div>

      {/* SUB-TAB 4.6 : QUESTIONS FREQUENTES */}
      {activeSubTab === 'faq' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={20} color="var(--primary)" />
              Base de Connaissances FAQ
            </h3>

            {/* Filter categories */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
              {faqCategories.map((cat) => (
                <button
                  key={cat}
                  className="btn btn-outline"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    background: categoryFilter === cat ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                    borderColor: categoryFilter === cat ? 'var(--primary)' : 'var(--border-color)',
                  }}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* FAQs List */}
            <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {faqs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                  Aucune FAQ enregistrée dans cette catégorie.
                </p>
              ) : (
                faqs.map((faq) => (
                  <div key={faq.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>{faq.category}</span>
                    <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Q: {faq.question}</strong>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>R: {faq.answer}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Form to Add FAQ */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} color="var(--success)" />
              Ajouter une FAQ Réponse Automatique
            </h3>
            <form onSubmit={handleAddFaq}>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select
                  className="form-control"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {faqCategories.filter(c => c !== 'tous').map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Question attendue</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ex: Quels sont les moyens de paiement acceptés ?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Réponse automatique formulée par l'IA</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Ex: Nous acceptons les cartes bancaires, les espèces, les chèques et la carte Vitale pour le tiers payant."
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                <Save size={16} /> Enregistrer la Réponse Automatique
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUB-TAB 4.7 : QUALIFICATION DES APPELS */}
      {activeSubTab === 'qualification' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Rules & Categories Grid */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} color="var(--primary)" />
              Catégories de Qualification et Routage
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Chaque appel ou message entrant est analysé par l'IA et classé automatiquement pour un traitement ou un transfert ciblé.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {qualificationCategories.map((c) => (
                <div key={c.key} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', borderLeft: `4px solid ${c.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.label}</strong>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {c.key === 'urgence' ? '⚠️ Transfert immédiat de l\'appel au 15 / Garde' : 'Traitement automatique & routage secrétariat'}
                    </span>
                  </div>
                  <span className="badge" style={{ background: c.color, color: '#fff', fontSize: '0.7rem' }}>
                    {c.key.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Tester */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall size={20} color="var(--secondary)" />
              Simulateur de Qualification en Temps Réel
            </h3>

            <form onSubmit={handleQualifyTest}>
              <div className="form-group">
                <label className="form-label">Saisir ou simuler une phrase du patient :</label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Ex: J'ai une très forte douleur à la poitrine depuis 10 minutes..."
                  value={qualifyText}
                  onChange={(e) => setQualifyText(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={qualifying} style={{ width: '100%' }}>
                {qualifying ? 'Analyse par l\'IA...' : 'Qualifier la demande'}
              </button>
            </form>

            {qualifyResult && (
              <div style={{ marginTop: '20px', padding: '16px', borderRadius: '10px', background: qualifyResult.isEmergency ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.15)', border: `1px solid ${qualifyResult.isEmergency ? 'var(--danger)' : 'var(--primary)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: qualifyResult.isEmergency ? 'var(--danger)' : 'var(--primary)' }}>
                    CLASSIFICATION : {qualifyResult.classification.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Confiance: {Math.round(qualifyResult.confidence * 100)}%
                  </span>
                </div>

                {qualifyResult.isEmergency ? (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={18} />
                    ALERTE URGENCE : Appel transféré immédiatement au médecin de garde !
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
                    <strong>Réponse recommandée :</strong> {qualifyResult.autoResponse}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4.8 : MESSAGERIE MULTICANAL */}
      {activeSubTab === 'messaging' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Send Message Panel */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={20} color="var(--primary)" />
              Envoi de Message & Notifications
            </h3>

            {msgSuccess && (
              <div style={{ padding: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
                <CheckCircle2 size={16} inline /> {msgSuccess}
              </div>
            )}

            <form onSubmit={handleSendMessage}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Canal de support</label>
                  <select className="form-control" value={msgChannel} onChange={(e) => setMsgChannel(e.target.value)}>
                    <option value="SMS">📱 SMS</option>
                    <option value="WHATSAPP">💬 WhatsApp</option>
                    <option value="EMAIL">✉️ Email</option>
                    <option value="CHAT">🌐 Chat Web</option>
                    <option value="MESSENGER">⚡ Messenger</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Type de fonction</label>
                  <select className="form-control" value={msgType} onChange={(e) => setMsgType(e.target.value)}>
                    <option value="AUTO_REPLY">Réponse automatique</option>
                    <option value="REMINDER">Rappel de RDV</option>
                    <option value="NOTIFICATION">Notification</option>
                    <option value="DOCUMENT">Envoi de documents</option>
                    <option value="MANUAL">Manuel</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">ID Patient destinataire</label>
                <input type="number" className="form-control" value={msgPatientId} onChange={(e) => setMsgPatientId(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Contenu du message</label>
                <textarea className="form-control" rows={3} value={msgContent} onChange={(e) => setMsgContent(e.target.value)} required placeholder="Saisir le texte ou la notification..." />
              </div>

              {msgType === 'DOCUMENT' && (
                <div className="form-group">
                  <label className="form-label">Lien du document (PDF/Image)</label>
                  <input type="text" className="form-control" placeholder="http://.../ordonnance.pdf" value={msgAttachment} onChange={(e) => setMsgAttachment(e.target.value)} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={sendingMsg}>
                  {sendingMsg ? 'Envoi...' : 'Envoyer le message'}
                </button>
                <button type="button" className="btn btn-outline" onClick={handleBulkReminders}>
                  Lancer Rappels RDV Automatiques
                </button>
              </div>
            </form>
          </div>

          {/* Messages History List */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={20} color="var(--secondary)" />
              Historique des Messages Envoyés
            </h3>

            <div style={{ flex: 1, maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
                  Aucun message enregistré dans l'historique.
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                      <span className="badge badge-primary">{m.channel}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: '4px 0', color: 'var(--text-primary)' }}>{m.content}</p>
                    {m.attachmentUrl && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={12} /> Document joint: {m.attachmentUrl}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
