import React, { useState } from 'react';
import { Shield, Key, Mail, Activity, Eye, EyeOff, Lock, CheckCircle, ArrowRight, UserCheck, Stethoscope, Phone } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  // Onglet actif : 'PATIENT' ou 'STAFF'
  const [activeSpace, setActiveSpace] = useState('PATIENT');
  
  // Champs de saisie
  const [email, setEmail] = useState('alice.dubois@gmail.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [code2FA, setCode2FA] = useState('');

  // Gérer le changement d'espace (Patient <-> Pro)
  const handleSpaceChange = (space) => {
    setActiveSpace(space);
    setError('');
    if (space === 'PATIENT') {
      setEmail('alice.dubois@gmail.com');
      setPassword('password123');
    } else {
      setEmail('marie.martin@cabinet.fr');
      setPassword('password123');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requires2FA && code2FA.length < 6) {
        throw new Error('Veuillez saisir le code à 6 chiffres reçu par SMS/Email.');
      }

      let response;
      try {
        response = await fetch('http://localhost:3000/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, isPatientSpace: activeSpace === 'PATIENT' }),
        });
      } catch (e1) {
        // Fallback vers le port 3001 si le port 3000 n'est pas actif
        response = await fetch('http://localhost:3001/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, isPatientSpace: activeSpace === 'PATIENT' }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Identifiants incorrects');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Impossible de se connecter au serveur backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleShortcutLogin = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      background: 'radial-gradient(ellipse at top, rgba(14, 165, 233, 0.15) 0%, rgba(11, 15, 25, 0.95) 70%)'
    }}>
      <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '480px', padding: '36px 40px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        
        {/* En-tête avec Logo & Titre */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2))',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.25)'
          }}>
            <Activity size={30} color="#0ea5e9" className="pulse-active" />
          </div>
          
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 800, 
            background: 'linear-gradient(to right, #0ea5e9, #818cf8)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em'
          }}>
            Secrétaire Médicale IA
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px', textAlign: 'center' }}>
            Portail Médical & Prise de Rendez-Vous 24/7
          </p>
        </div>

        {/* Sélecteur d'Espace : Patient vs Cabinet Médical */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => handleSpaceChange('PATIENT')}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: activeSpace === 'PATIENT' ? 'var(--primary)' : 'transparent',
              color: activeSpace === 'PATIENT' ? 'white' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <UserCheck size={16} /> Espace Patient
          </button>

          <button
            type="button"
            onClick={() => handleSpaceChange('STAFF')}
            style={{
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: activeSpace === 'STAFF' ? 'var(--secondary)' : 'transparent',
              color: activeSpace === 'STAFF' ? 'white' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <Stethoscope size={16} /> Personnel Cabinet
          </button>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Lock size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit}>
          {!requires2FA ? (
            <>
              <div className="form-group">
                <label className="form-label">
                  {activeSpace === 'PATIENT' ? 'Email ou N° Téléphone Patient' : 'Email Professionnel'}
                </label>
                <div style={{ position: 'relative' }}>
                  {activeSpace === 'PATIENT' ? (
                    <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                  ) : (
                    <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                  )}
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '44px' }}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={activeSpace === 'PATIENT' ? "ex: alice.dubois@gmail.com ou +33612345678" : "ex: marie.martin@cabinet.fr"}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label">Mot de Passe</label>
                <div style={{ position: 'relative' }}>
                  <Key size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    style={{ paddingLeft: '44px', paddingRight: '44px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', fontSize: '0.8rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Se souvenir de moi
                </label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Un SMS ou email de réinitialisation a été envoyé."); }} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  Mot de passe oublié ?
                </a>
              </div>
            </>
          ) : (
            /* Étape 2FA */
            <div className="form-group animate-slide-in">
              <label className="form-label">Code de Vérification 2FA</label>
              <div style={{ position: 'relative' }}>
                <Shield size={18} color="var(--primary)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '44px', letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                  value={code2FA}
                  onChange={(e) => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Entrez le code à 6 chiffres reçu par SMS ou votre application 2FA.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn"
            style={{ 
              width: '100%', 
              padding: '13px', 
              fontWeight: 600, 
              fontSize: '0.95rem',
              background: activeSpace === 'PATIENT' ? 'var(--primary)' : 'var(--secondary)',
              color: 'white'
            }}
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                {activeSpace === 'PATIENT' ? 'Accéder à mon Espace Patient' : 'Connexion Espace Pro'} <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        {/* Accès rapide Démo */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '10px' }}>
            Accès rapide (Comptes Démo {activeSpace === 'PATIENT' ? 'Patients' : 'Cabinet'}) :
          </span>
          
          {activeSpace === 'PATIENT' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ fontSize: '0.75rem', padding: '8px 6px', border: email === 'alice.dubois@gmail.com' ? '1px solid var(--primary)' : undefined }}
                onClick={() => handleShortcutLogin('alice.dubois@gmail.com')}
              >
                👤 Alice Dubois
              </button>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ fontSize: '0.75rem', padding: '8px 6px', border: email === 'bob.lemoine@yahoo.fr' ? '1px solid var(--primary)' : undefined }}
                onClick={() => handleShortcutLogin('bob.lemoine@yahoo.fr')}
              >
                👤 Bob Lemoine
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ fontSize: '0.75rem', padding: '8px 4px', border: email === 'marie.martin@cabinet.fr' ? '1px solid var(--secondary)' : undefined }}
                onClick={() => handleShortcutLogin('marie.martin@cabinet.fr')}
              >
                Secrétaire
              </button>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ fontSize: '0.75rem', padding: '8px 4px', border: email === 'jean.dupont@cabinet.fr' ? '1px solid var(--secondary)' : undefined }}
                onClick={() => handleShortcutLogin('jean.dupont@cabinet.fr')}
              >
                Médecin
              </button>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ fontSize: '0.75rem', padding: '8px 4px', border: email === 'admin@cabinet.fr' ? '1px solid var(--secondary)' : undefined }}
                onClick={() => handleShortcutLogin('admin@cabinet.fr')}
              >
                Admin
              </button>
            </div>
          )}
        </div>

        {/* Pied de page & Badges de sécurité */}
        <div style={{ 
          marginTop: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '16px', 
          fontSize: '0.72rem', 
          color: 'var(--text-muted)',
          paddingTop: '14px',
          borderTop: '1px solid rgba(255,255,255,0.05)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Shield size={13} color="#10b981" /> Chiffrement AES-256
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={13} color="#0ea5e9" /> Données de Santé RGPD
          </span>
        </div>

      </div>
    </div>
  );
}


