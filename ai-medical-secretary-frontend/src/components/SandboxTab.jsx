import React, { useState } from 'react';
import { FileText, Cpu, ScanLine, FileCheck, FileCode, CheckCircle, Download, Mic, Sparkles } from 'lucide-react';

export default function SandboxTab({ token }) {
  // OCR State
  const [ocrDocType, setOcrDocType] = useState('carte_vitale');
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);

  // Dictation State
  const [dictationText, setDictationText] = useState(
    "Consultation de contrôle Alice Dubois. Tension 12/7. Patient présente une légère angine rouge sans fièvre. Prescription de paracétamol et sirop pour la toux. Repos de 2 jours préconisé."
  );
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);

  // Trigger OCR analysis simulation
  const handleOcrScan = async () => {
    setScanning(true);
    setOcrResult(null);

    // Simulate scanning laser animation for 2 seconds
    setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/services/ocr/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType: ocrDocType }),
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
    }, 2000);
  };

  // Trigger Clinical Dictation simulation
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setReportResult(null);

    // Simulate AI clinical generation for 2.5 seconds
    setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/services/dictations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            patientId: 1, // Alice Dubois
            rawTranscript: dictationText,
            summary: "Examen clinique normal. Angine rouge bénigne diagnostiquée.",
            notes: "Prescription: Paracétamol 1g (3/jour) + Sirop Hélicidine. Arrêt de travail: 2 jours."
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
    }, 2500);
  };

  const loadDictationTemplate = () => {
    setDictationText(
      "Patient Bob Lemoine. Venu pour renouvellement de traitement antihypertenseur. Examen clinique: poumons libres, pas d'œdème. Tension 13/8. Traitement prolongé pour 6 mois. Pas de modification de posologie."
    );
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Sandbox IA (OCR & Dictée)</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Démonstrations interactives de lecture de documents et dictée clinique assistée</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        
        {/* 1. OCR Documents Parsing */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={20} color="var(--primary)" />
            Module OCR : Lecture automatique de documents
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Sélectionnez un document médical ou administratif type, puis lancez le scan OCR pour voir l'IA structurer et lire les données automatiquement (CDC Section 4.11).
          </p>

          <div className="form-group">
            <label className="form-label">Type de document</label>
            <select
              className="form-control"
              value={ocrDocType}
              onChange={(e) => {
                setOcrDocType(e.target.value);
                setOcrResult(null);
              }}
            >
              <option value="carte_vitale">Carte Vitale (Assurance Maladie)</option>
              <option value="ordonnance">Ordonnance médicale</option>
              <option value="mutuelle">Attestation Mutuelle</option>
              <option value="cin">Carte d'Identité Nationale (CIN)</option>
            </select>
          </div>

          {/* Visual Document Box representation */}
          <div style={{
            position: 'relative',
            height: '160px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
            borderRadius: '12px',
            border: '2px dashed var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            {/* Scanner line scanning */}
            {scanning && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: '4px',
                  background: 'var(--primary)',
                  boxShadow: '0 0 15px var(--primary)',
                  animation: 'scan-anim 2s infinite ease-in-out',
                  zIndex: 2
                }}
              />
            )}
            
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <FileCheck size={36} color={scanning ? 'var(--primary)' : 'var(--text-muted)'} className={scanning ? 'pulse-active' : ''} />
              <strong style={{ display: 'block', fontSize: '0.85rem', marginTop: '8px' }}>
                {ocrDocType.replace('_', ' ').toUpperCase()}
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {scanning ? 'Lecture optique en cours...' : 'Fichier chargé virtuellement'}
              </span>
            </div>

            {/* Custom Scan Animation CSS */}
            <style>{`
              @keyframes scan-anim {
                0% { top: 0%; }
                50% { top: 96%; }
                100% { top: 0%; }
              }
            `}</style>
          </div>

          <button className="btn btn-primary" onClick={handleOcrScan} disabled={scanning} style={{ width: '100%', marginBottom: '20px' }}>
            <ScanLine size={18} />
            Analyser le document (OCR)
          </button>

          {/* OCR Result Output */}
          {ocrResult && (
            <div className="animate-slide-in" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', flex: 1 }}>
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
                <CheckCircle size={14} /> Données extraites avec succès :
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                {Object.entries(ocrResult).map(([key, val]) => (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{key}:</span>
                    <strong style={{ wordBreak: 'break-all' }}>
                      {Array.isArray(val) ? val.map((med, index) => `${med.name} (${med.dosage})`).join(', ') : String(val)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Dictation Synthesis */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mic size={20} color="var(--secondary)" />
            Dictée médicale & Compte-rendu clinique
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Simulez la transcription audio clinique du médecin pour générer instantanément un compte-rendu structuré et un brouillon d'ordonnance exportable (CDC Section 4.10).
          </p>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="form-label">Notes vocales brutes (transcription)</label>
              <button 
                type="button" 
                onClick={loadDictationTemplate}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500 }}
              >
                Charger un autre exemple
              </button>
            </div>
            <textarea
              className="form-control"
              rows={4}
              value={dictationText}
              onChange={(e) => setDictationText(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          <button className="btn btn-secondary" onClick={handleGenerateReport} disabled={generatingReport} style={{ width: '100%', marginBottom: '20px' }}>
            <Sparkles size={18} />
            {generatingReport ? 'Analyse clinique en cours...' : 'Générer le compte-rendu clinique (IA)'}
          </button>

          {/* Dictation Result Card */}
          {reportResult && (
            <div className="animate-slide-in" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMPTE RENDU EXAMEN CLINIQUE</span>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '2px' }}>Patient: Alice Dubois</h4>
              </div>
              
              <div>
                <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-secondary)' }}>Synthèse de l'examen :</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '2px' }}>{reportResult.summary}</p>
              </div>

              <div>
                <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-secondary)' }}>Brouillon notes d'ordonnance :</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{reportResult.notes}</p>
              </div>

              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); alert("Téléchargement du fichier PDF simulé : " + reportResult.exportPdfUrl); }}
                className="btn btn-outline"
                style={{ fontSize: '0.75rem', padding: '8px', alignSelf: 'flex-start', marginTop: '4px' }}
              >
                <Download size={14} /> Exporter au format PDF
              </a>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
