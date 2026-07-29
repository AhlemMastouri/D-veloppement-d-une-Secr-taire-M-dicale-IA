import React, { useState } from 'react';
import { Shield, Key, Mail, Activity, Eye, EyeOff, Lock, CheckCircle, ArrowRight, UserCheck, Stethoscope, Phone, User, Calendar, Building2 } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  // Onglet actif : 'PATIENT' ou 'STAFF'
  const [activeSpace, setActiveSpace] = useState('PATIENT');

  // Mode actif : 'SIGNIN' ou 'SIGNUP'
  const [mode, setMode] = useState('SIGNIN');

  // Champs de connexion
  const [email, setEmail] = useState('alice.dubois@gmail.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [code2FA, setCode2FA] = useState('');

  // Champs additionnels pour l'inscription
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [staffRole, setStaffRole] = useState('SECRETAIRE');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Gérer le changement d'espace (Patient <-> Pro)
  const handleSpaceChange = (space) => {
    setActiveSpace(space);
    setError('');
    setSuccess('');
    if (space === 'PATIENT') {
      setEmail('alice.dubois@gmail.com');
      setPassword('password123');
    } else {
      setEmail('marie.martin@cabinet.fr');
      setPassword('password123');
    }
  };

  // Gérer le changement de mode (Connexion <-> Inscription)
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setRequires2FA(false);
    setCode2FA('');
    if (newMode === 'SIGNUP') {
      setPassword('');
      setEmail('');
    } else if (activeSpace === 'PATIENT') {
      setEmail('alice.dubois@gmail.com');
      setPassword('password123');
    } else {
      setEmail('marie.martin@cabinet.fr');
      setPassword('password123');
    }
  };

  const buildApiUrl = (path) => `http://localhost:3001${path}`;
  const buildApiUrlFallback = (path) => `http://localhost:3001${path}`;

  const postJson = async (path, body) => {
    try {
      return await fetch(buildApiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e1) {
      // Fallback vers le port 3001 si le port 3000 n'est pas actif
      return await fetch(buildApiUrlFallback(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
  };

  const handleSignIn = async () => {
    if (requires2FA && code2FA.length < 6) {
      throw new Error('Veuillez saisir le code à 6 chiffres reçu par SMS/Email.');
    }

    const response = await postJson('/api/v1/auth/login', {
      email,
      password,
      isPatientSpace: activeSpace === 'PATIENT',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Identifiants incorrects');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    onLoginSuccess(data.user, data.token);
  };

  const handleSignUp = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      throw new Error('Merci de renseigner votre nom et votre prénom.');
    }
    if (!email.trim()) {
      throw new Error('Merci de renseigner un email valide.');
    }
    if (activeSpace === 'PATIENT' && !phone.trim()) {
      throw new Error('Merci de renseigner un numéro de téléphone.');
    }
   
    if (activeSpace === 'STAFF' && !staffRole) {
      throw new Error('Merci de sélectionner votre rôle au sein du cabinet.');
    }
    if (password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    }
    if (password !== confirmPassword) {
      throw new Error('Les mots de passe ne correspondent pas.');
    }
    if (!acceptTerms) {
      throw new Error("Merci d'accepter la politique de confidentialité des données de santé.");
    }

    const payload = {
      firstName,
      lastName,
      email,
      password,
      isPatientSpace: activeSpace === 'PATIENT',
      ...(activeSpace === 'PATIENT' ? { phone, birthDate } : { inviteCode, role: staffRole }),
    };

    const response = await postJson('/api/v1/auth/register', payload);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de créer le compte.');
    }

    setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
    setMode('SIGNIN');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'SIGNIN') {
        await handleSignIn();
      } else {
        await handleSignUp();
      }
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
    setSuccess('');
  };

  const isSignUp = mode === 'SIGNUP';

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
          marginBottom: '16px'
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

        {/* Sélecteur Sign In / Sign Up */}
        <div style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '22px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => handleModeChange('SIGNIN')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 10px 0',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: !isSignUp ? 'var(--text-primary, #fff)' : 'var(--text-muted)',
              borderBottom: !isSignUp ? '2px solid #0ea5e9' : '2px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('SIGNUP')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 0 10px 0',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: isSignUp ? 'var(--text-primary, #fff)' : 'var(--text-muted)',
              borderBottom: isSignUp ? '2px solid #0ea5e9' : '2px solid transparent',
              transition: 'all 0.2s ease'
            }}
          >
            Créer un compte
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

        {/* Message de succès */}
        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit}>
          {!requires2FA ? (
            <>
              {/* Champs supplémentaires pour l'inscription */}
              {isSignUp && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Prénom</label>
                      <div style={{ position: 'relative' }}>
                        <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                        <input
                          type="text"
                          className="form-control"
                          style={{ paddingLeft: '44px' }}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Alice"
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nom</label>
                      <div style={{ position: 'relative' }}>
                        <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                        <input
                          type="text"
                          className="form-control"
                          style={{ paddingLeft: '44px' }}
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Dubois"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {activeSpace === 'PATIENT' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Téléphone</label>
                        <div style={{ position: 'relative' }}>
                          <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                          <input
                            type="tel"
                            className="form-control"
                            style={{ paddingLeft: '44px' }}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+33 6 12 34 56 78"
                            required
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Date de naissance</label>
                        <div style={{ position: 'relative' }}>
                          <Calendar size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                          <input
                            type="date"
                            className="form-control"
                            style={{ paddingLeft: '44px' }}
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label">Rôle au sein du cabinet</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setStaffRole('MEDECIN')}
                            style={{
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: staffRole === 'MEDECIN' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                              background: staffRole === 'MEDECIN' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              color: staffRole === 'MEDECIN' ? 'var(--secondary)' : 'var(--text-secondary)',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Stethoscope size={16} /> Médecin
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffRole('SECRETAIRE')}
                            style={{
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: staffRole === 'SECRETAIRE' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                              background: staffRole === 'SECRETAIRE' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              color: staffRole === 'SECRETAIRE' ? 'var(--secondary)' : 'var(--text-secondary)',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <UserCheck size={16} /> Secrétaire
                          </button>
                          <button
                            type="button"
                            onClick={() => setStaffRole('ADMIN')}
                            style={{
                              padding: '10px 6px',
                              borderRadius: '8px',
                              border: staffRole === 'ADMIN' ? '1px solid var(--secondary)' : '1px solid var(--border-color)',
                              background: staffRole === 'ADMIN' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              color: staffRole === 'ADMIN' ? 'var(--secondary)' : 'var(--text-secondary)',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Shield size={16} /> Admin
                          </button>
                        </div>
                      </div>

                    </>
                  )}
                </>
              )}

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

              <div className="form-group" style={{ marginBottom: isSignUp ? '18px' : '18px' }}>
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
                {isSignUp && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                    8 caractères minimum.
                  </span>
                )}
              </div>

              {isSignUp && (
                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label">Confirmer le mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '13px' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      style={{ paddingLeft: '44px' }}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
              )}

              {!isSignUp ? (
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
              ) : (
                <div style={{ marginBottom: '24px', fontSize: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      style={{ accentColor: 'var(--primary)', marginTop: '2px' }}
                    />
                    <span>
                      J'accepte que mes données de santé soient traitées conformément au RGPD et à la politique de confidentialité du cabinet.
                    </span>
                  </label>
                </div>
              )}
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
            {loading ? (isSignUp ? 'Création du compte...' : 'Connexion en cours...') : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                {isSignUp
                  ? 'Créer mon compte'
                  : (activeSpace === 'PATIENT' ? 'Accéder à mon Espace Patient' : 'Connexion Espace Pro')}
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        {/* Lien de bascule Connexion / Inscription */}
        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {isSignUp ? (
            <span>
              Déjà un compte ?{' '}
              <a href="#signin" onClick={(e) => { e.preventDefault(); handleModeChange('SIGNIN'); }} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Se connecter
              </a>
            </span>
          ) : (
            <span>
              Pas encore de compte ?{' '}
              <a href="#signup" onClick={(e) => { e.preventDefault(); handleModeChange('SIGNUP'); }} style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Créer un compte
              </a>
            </span>
          )}
        </div>

        {/* Accès rapide Démo (uniquement en mode Connexion) */}
        {!isSignUp && (
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
        )}

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