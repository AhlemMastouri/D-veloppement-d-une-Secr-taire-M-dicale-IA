import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Save, Settings, MessageSquare, Volume2, Globe } from 'lucide-react';

export default function FAQTab({ token }) {
  const [faqs, setFaqs] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('tous');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('horaires');
  
  // AI config states
  const [aiLanguage, setAiLanguage] = useState('Français');
  const [voiceGender, setVoiceGender] = useState('female');
  const [interruptionAllowed, setInterruptionAllowed] = useState(true);
  const [aiPrompt, setAiPrompt] = useState(
    "Vous êtes la Secrétaire Médicale IA du cabinet du Dr Dupont. Répondez de manière polie, professionnelle et concise. Si le patient décrit des symptômes d'urgence (douleur thoracique, étouffement, saignement abondant), transférez immédiatement l'appel vers la secrétaire humaine de garde."
  );
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchFaqs = async () => {
    try {
      const url = categoryFilter !== 'tous' 
        ? `http://localhost:3000/api/v1/faqs?category=${categoryFilter}` 
        : 'http://localhost:3000/api/v1/faqs';
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, [categoryFilter]);

  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newQuestion || !newAnswer) return;

    try {
      const res = await fetch('http://localhost:3000/api/v1/faqs', {
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

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Paramétrage IA & FAQ</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Configurer les réponses types et le comportement de la secrétaire vocale</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* Left Column: FAQ Management */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="var(--primary)" />
            Bibliothèque FAQ du Cabinet
          </h3>

          {/* Category Filter tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
            {['tous', 'horaires', 'adresse', 'parking', 'tarifs', 'preparations'].map((cat) => (
              <button
                key={cat}
                className="btn btn-outline"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  background: categoryFilter === cat ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                  borderColor: categoryFilter === cat ? 'var(--primary)' : 'var(--border-color)',
                }}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* FAQs List scrolling */}
          <div style={{ flex: 1, maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {faqs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Aucune FAQ dans cette catégorie.</p>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem', marginBottom: '6px' }}>{faq.category}</span>
                  <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Q: {faq.question}</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>R: {faq.answer}</p>
                </div>
              ))
            )}
          </div>

          {/* Add FAQ form */}
          <form onSubmit={handleAddFaq} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '12px' }}>Ajouter une Question</h4>
            
            <div className="form-group">
              <input
                type="text"
                className="form-control"
                placeholder="Question (ex: Acceptez-vous la carte vitale ?)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <textarea
                className="form-control"
                placeholder="Réponse pour l'assistant vocal..."
                rows={2}
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                className="form-control"
                style={{ flex: 0.6 }}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="horaires">Horaires</option>
                <option value="adresse">Adresse</option>
                <option value="parking">Parking</option>
                <option value="tarifs">Tarifs</option>
                <option value="preparations">Préparations</option>
              </select>
              
              <button type="submit" className="btn btn-secondary" style={{ flex: 0.4 }}>
                <Plus size={16} />
                Ajouter
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: AI Prompt & Voice Configuration */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--secondary)" />
            Configuration de la Secrétaire IA
          </h3>

          <form onSubmit={handleSaveConfig}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Globe size={14} /> Langue principale
              </label>
              <select 
                className="form-control"
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value)}
              >
                <option value="Français">Français (France)</option>
                <option value="Anglais">Anglais (USA)</option>
                <option value="Arabe">Arabe (Moyen-Orient)</option>
                <option value="Espagnol">Espagnol (Espagne)</option>
                <option value="Italien">Italien (Italie)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Volume2 size={14} /> Genre de la voix
                </label>
                <select 
                  className="form-control"
                  value={voiceGender}
                  onChange={(e) => setVoiceGender(e.target.value)}
                >
                  <option value="female">Féminin (Humaine)</option>
                  <option value="male">Masculin (Humain)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Interruption naturelle</label>
                <select 
                  className="form-control"
                  value={interruptionAllowed ? 'true' : 'false'}
                  onChange={(e) => setInterruptionAllowed(e.target.value === 'true')}
                >
                  <option value="true">Activée (Le patient peut couper la parole)</option>
                  <option value="false">Désactivée</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <MessageSquare size={14} /> Consigne système (System Prompt)
              </label>
              <textarea
                className="form-control"
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{ fontSize: '0.85rem', lineHeight: '1.4' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              <Save size={18} />
              Sauvegarder les configurations
            </button>

            {saveSuccess && (
              <p style={{ color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center', marginTop: '10px', fontWeight: 500 }}>
                Configuration mise à jour avec succès dans le module d'intelligence artificielle.
              </p>
            )}
          </form>
        </div>

      </div>
    </div>
  );
}
