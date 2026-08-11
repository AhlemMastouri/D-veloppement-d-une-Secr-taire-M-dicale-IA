import React, { useState } from 'react';
import { 
  FileText, Cpu, ScanLine, FileCheck, CheckCircle, Download, Mic, Sparkles, 
  CreditCard, Bell, Send, Upload, FileCode
} from 'lucide-react';
import PaymentsTab from './PaymentsTab';

const API_BASE = 'http://localhost:3001/api/v1';

export default function SandboxTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('ocr');

  // --- 4.9 NOTIFICATIONS ---
  const [notifPatientId, setNotifPatientId] = useState('1');
  const [notifType, setNotifType] = useState('CONFIRMATION');
  const [notifChannel, setNotifChannel] = useState('SMS');
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState(null);

  // --- 4.10 DICTÉE MÉDICALE ---
  const [dictationText, setDictationText] = useState(
    "Consultation de contrôle Alice Dubois. Patient présente une toux sèche avec légère angine sans fièvre. Pression artérielle 12/7. Ordonnance de paracétamol 1g et sirop hélicidine. Repos préconisé pendant 2 jours."
  );
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  // --- 4.11 OCR & UPLOAD PHOTO ---
  const [ocrDocType, setOcrDocType] = useState('carte_vitale');
  const [selectedImage, setSelectedImage] = useState(null); // Preview URL
  const [base64Image, setBase64Image] = useState('');
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // Handle Photo / File Upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
        setBase64Image(reader.result);
        setOcrResult(null); // Reset previous scan
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger Notifications
  const handleSendNotification = async (e) => {
    e.preventDefault();
    setNotifSending(true);
    setNotifResult(null);

    const messagesMap = {
      CONFIRMATION: "Confirmation: Votre rendez-vous est confirmé avec le Dr. Dupont pour demain à 14h30.",
      RAPPEL_J1: "Rappel (J-1): Votre consultation avec le Dr. Dupont a lieu demain à 14h30. Répondez ANNULER si indisponible.",
      RAPPEL_H2: "Rappel (H-2): Votre rendez-vous au cabinet médical démarre dans 2 heures (14h30).",
      ANNULATION: "Information: Votre rendez-vous a bien été annulé.",
      MODIFICATION: "Mise à jour: Votre rendez-vous a été déplacé au vendredi à 15h00.",
      DOCUMENT_DISPONIBLE: "Document: Un nouveau compte-rendu médical ou ordonnance est disponible sur votre espace sécurisé."
    };

    try {
      const res = await fetch(`${API_BASE}/messaging/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: notifPatientId,
          channel: notifChannel,
          type: 'NOTIFICATION',
          content: messagesMap[notifType]
        })
      });
      if (res.ok) {
        const data = await res.json();
        setNotifResult({ type: notifType, message: messagesMap[notifType], channel: notifChannel, data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setNotifSending(false);
    }
  };

  // Trigger Dictation
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setReportResult(null);

    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/services/dictations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            patientId: 1,
            rawTranscript: dictationText,
            summary: "Examen clinique normal. Angine rouge bénigne diagnostiquée par le médecin.",
            notes: "Prescription: Paracétamol 1g (3/jour) + Sirop Hélicidine. Arrêt de travail préconisé: 2 jours."
          })
        });

        if (res.ok) {
          const data = await res.json();
          setReportResult(data.dictation);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setGeneratingReport(false);
      }
    }, 1500);
  };

  // Trigger OCR with optional uploaded photo
  const handleOcrScan = async () => {
    setScanning(true);
    setOcrResult(null);

    setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/services/ocr/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType: ocrDocType, image: base64Image }),
        });

        if (res.ok) {
          const data = await res.json();
          setOcrResult(data.parsedData);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setScanning(false);
      }
    }, 1500);
  };

  // Download Extracted File (.TXT or .JSON)
  const handleDownloadExtractedFile = (format) => {
    if (!ocrResult) return;
    const textContent = encodeURIComponent(JSON.stringify(ocrResult, null, 2));
    window.location.href = `${API_BASE}/services/export-doc/download?format=${format}&docType=${ocrDocType}&content=${textContent}`;
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Sandbox IA & Services Médicaux</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Démonstration des modules d'Intelligence Artificielle, OCR, Notifications et Paiement (4.9 - 4.12)</p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${activeSubTab === 'ocr' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('ocr')}
        >
          <ScanLine size={16} /> 4.11 OCR & Import Photo
        </button>
        <button 
          className={`btn ${activeSubTab === 'dictation' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('dictation')}
        >
          <Mic size={16} /> 4.10 Dictée Médicale IA
        </button>
        <button 
          className={`btn ${activeSubTab === 'notifications' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('notifications')}
        >
          <Bell size={16} /> 4.9 Notifications Auto
        </button>
        <button 
          className={`btn ${activeSubTab === 'payment' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('payment')}
        >
          <CreditCard size={16} /> 4.12 Paiement & Factures
        </button>
      </div>

      {/* 4.11 OCR & UPLOAD PHOTO */}
      {activeSubTab === 'ocr' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ScanLine size={20} color="var(--primary)" />
              Lecture Optique (OCR) & Importation d'Image
            </h3>

            <div className="form-group">
              <label className="form-label">1. Type de document à scanner :</label>
              <select className="form-control" value={ocrDocType} onChange={(e) => setOcrDocType(e.target.value)}>
                <option value="carte_vitale">Carte Vitale</option>
                <option value="ordonnance">Ordonnance Médicale</option>
                <option value="mutuelle">Attestation Mutuelle</option>
                <option value="cin">Carte d'Identité Nationale (CIN)</option>
                <option value="passeport">Passeport Biométrique</option>
                <option value="resultats_analyses">Résultats d'Analyses Biologiques</option>
              </select>
            </div>

            {/* Photo Upload Zone */}
            <div className="form-group">
              <label className="form-label">2. Choisir / Prendre une photo du document :</label>
              <div style={{
                position: 'relative',
                border: '2px dashed var(--primary)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                background: 'rgba(14, 165, 233, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%', height: '100%'
                  }}
                />
                
                {selectedImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img src={selectedImage} alt="Document chargé" style={{ maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>✓ Image importée avec succès (Prête pour analyse)</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                    <Upload size={32} />
                    <strong style={{ fontSize: '0.85rem' }}>Cliquez ou glissez une photo ici (Carte, Ordonnance, Passeport)</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Formats acceptés: JPG, PNG, WEBP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scanner visual animation box */}
            <div style={{
              position: 'relative',
              height: '110px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
              borderRadius: '12px',
              border: '1px dashed var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              marginBottom: '16px'
            }}>
              {scanning && (
                <div 
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '4px',
                    background: 'var(--primary)',
                    boxShadow: '0 0 15px var(--primary)',
                    animation: 'scan-anim 1.5s infinite ease-in-out',
                    zIndex: 2
                  }}
                />
              )}
              
              <div style={{ textAlign: 'center' }}>
                <FileCheck size={28} color={scanning ? 'var(--primary)' : 'var(--text-muted)'} className={scanning ? 'pulse-active' : ''} />
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {scanning ? 'Lecture optique en cours...' : selectedImage ? 'Document personnalisé prêt' : 'Simulation d\'analyse par défaut'}
                </span>
              </div>

              <style>{`
                @keyframes scan-anim {
                  0% { top: 0%; }
                  50% { top: 96%; }
                  100% { top: 0%; }
                }
              `}</style>
            </div>

            <button className="btn btn-primary" onClick={handleOcrScan} disabled={scanning} style={{ width: '100%' }}>
              <Cpu size={18} />
              {scanning ? 'Analyse OCR optique en cours...' : 'Lancer le scan OCR de la photo'}
            </button>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} color="var(--success)" />
              Données Extraites & Exportation de Fichier
            </h3>

            {ocrResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    {Object.entries(ocrResult).map(([key, val]) => (
                      <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                        <strong style={{ wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Save / Download Extracted File Section */}
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)', borderRadius: '12px', padding: '16px' }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--success)', marginBottom: '8px' }}>
                    💾 Enregistrer & Télécharger les données extraites :
                  </strong>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--success)', flex: 1, fontSize: '0.8rem' }} onClick={() => handleDownloadExtractedFile('txt')}>
                      <Download size={14} /> Enregistrer (.TXT)
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => handleDownloadExtractedFile('json')}>
                      <FileCode size={14} /> Enregistrer (.JSON)
                    </button>
                    <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => handleDownloadExtractedFile('pdf')}>
                      <FileText size={14} /> Rapport (.HTML)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px' }}>
                Importez une photo et lancez l'analyse OCR pour extraire et télécharger les données enregistrées.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4.10 DICTÉE MÉDICALE IA */}
      {activeSubTab === 'dictation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mic size={20} color="var(--secondary)" />
              Dictée & Transcription Audio Clinique
            </h3>

            <div className="form-group">
              <label className="form-label">Transcription brute de la consultation (parlée par le médecin)</label>
              <textarea
                className="form-control"
                rows={5}
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <button className="btn btn-secondary" onClick={handleGenerateReport} disabled={generatingReport} style={{ width: '100%' }}>
              <Sparkles size={18} />
              {generatingReport ? 'Analyse et rédaction IA en cours...' : 'Générer le compte-rendu clinique & PDF'}
            </button>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--success)" />
              Brouillon de Note Clinique & Export PDF
            </h3>

            {reportResult ? (
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Résumé automatique :</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '4px' }}>{reportResult.summary}</p>
                </div>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Notes cliniques corrigées :</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>{reportResult.notes}</p>
                </div>
                <button className="btn btn-outline" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }} onClick={() => window.location.href = `${API_BASE}/services/export-doc/download?format=pdf&docType=Compte_Rendu_Alice_Dubois&content=${encodeURIComponent(reportResult.notes)}`}>
                  <Download size={14} /> Enregistrer & Télécharger le compte-rendu
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
                Générez le compte-rendu pour voir le brouillon rédigé automatiquement par l'IA.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4.9 NOTIFICATIONS */}
      {activeSubTab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={20} color="var(--primary)" />
              Envoi Automatique de Notifications
            </h3>

            <form onSubmit={handleSendNotification}>
              <div className="form-group">
                <label className="form-label">Événement déclencheur</label>
                <select className="form-control" value={notifType} onChange={(e) => setNotifType(e.target.value)}>
                  <option value="CONFIRMATION">1. Confirmation de rendez-vous</option>
                  <option value="RAPPEL_J1">2. Rappel de rendez-vous (J-1)</option>
                  <option value="RAPPEL_H2">3. Rappel imminent (H-2)</option>
                  <option value="ANNULATION">4. Notification d'annulation</option>
                  <option value="MODIFICATION">5. Modification de rendez-vous</option>
                  <option value="DOCUMENT_DISPONIBLE">6. Document médical disponible</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Canal de diffusion</label>
                <select className="form-control" value={notifChannel} onChange={(e) => setNotifChannel(e.target.value)}>
                  <option value="SMS">📱 SMS</option>
                  <option value="WHATSAPP">💬 WhatsApp</option>
                  <option value="EMAIL">✉️ Email</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ID Patient destinataire</label>
                <input type="number" className="form-control" value={notifPatientId} onChange={(e) => setNotifPatientId(e.target.value)} required />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={notifSending}>
                {notifSending ? 'Envoi en cours...' : 'Déclencher la notification'}
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={20} color="var(--secondary)" />
              Aperçu du message reçu par le patient
            </h3>

            {notifResult ? (
              <div style={{ padding: '16px', background: 'rgba(14,165,233,0.15)', border: '1px solid var(--primary)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge badge-primary">{notifResult.channel}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Statut: ENVOYÉ</span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '8px' }}>{notifResult.message}</p>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
                Sélectionnez un type de notification à gauche et déclenchez l'envoi pour simuler la réception.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4.12 PAIEMENT & FACTURES — module complet : PayPal, Stripe (carte bancaire),
          paiement au cabinet (espèces/chèque/virement), acomptes, remboursements et factures PDF.
          On réutilise directement le composant PaymentsTab pour éviter toute duplication de logique. */}
      {activeSubTab === 'payment' && (
        <PaymentsTab token={token} />
      )}
    </div>
  );
}