import React, { useState, useEffect } from 'react';
import { 
  Share2, Shield, Download, RefreshCw, CheckCircle, Lock, Calendar, Phone, 
  Database, FileSpreadsheet, FileText, Activity, AlertCircle, Eye, Printer, Filter
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

export default function IntegrationsTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('exports'); // Default to exports to showcase the upgrade
  
  // Integrations state
  const [integrationsData, setIntegrationsData] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Security Audit Logs state
  const [logs, setLogs] = useState([]);
  const [secStats, setSecStats] = useState(null);

  // Export state
  const [exportingType, setExportingType] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrationsData(data.integrations);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSecurityLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrations/audit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setSecStats(data.securityStats);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchIntegrations();
    fetchSecurityLogs();
  }, [token]);

  const handleTriggerSync = async (target) => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`${API_BASE}/integrations/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMessage(data.message);
        fetchIntegrations();
        setTimeout(() => setSyncMessage(''), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadExcel = (type) => {
    setExportingType(type);
    window.location.href = `${API_BASE}/integrations/report/excel?type=${type}`;
    setTimeout(() => setExportingType(null), 1500);
  };

  const handleGeneratePdf = async () => {
    setExportingType('pdf');
    try {
      const res = await fetch(`${API_BASE}/integrations/report/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const html = await res.text();
        setPdfPreview(html);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Intégrations, Sécurité & Exportations Pro</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Connexions logiciels médicaux, traçabilité RGPD et générateur de rapports Excel/PDF</p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          className={`btn ${activeSubTab === 'exports' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('exports')}
        >
          <Download size={16} /> 10 & 11. Module d'Exportation Pro (Excel / PDF)
        </button>
        <button 
          className={`btn ${activeSubTab === 'software' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('software')}
        >
          <Share2 size={16} /> 6. Intégrations API & Connecteurs
        </button>
        <button 
          className={`btn ${activeSubTab === 'security' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('security')}
        >
          <Shield size={16} /> 7 & 9. Sécurité & Traçabilité RGPD
        </button>
      </div>

      {/* SUB-TAB 10 & 11 : EXPORTS & LIVRABLES */}
      {activeSubTab === 'exports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Export Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            
            {/* Excel Appointments */}
            <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--success)' }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Export Rendez-vous</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tableau complet .CSV (UTF-8 Excel)</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Téléchargez la liste intégrale des rendez-vous avec statuts, médecins, patients et téléphones.
                </p>
              </div>
              <button className="btn btn-primary" style={{ background: 'var(--success)', width: '100%' }} onClick={() => handleDownloadExcel('appointments')} disabled={exportingType === 'appointments'}>
                <Download size={16} /> Exporter les RDV (Excel)
              </button>
            </div>

            {/* Excel Patients */}
            <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Export Registre Patients</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fichier .CSV structuré</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Base de données patients avec numéros d'assurance, téléphones et médecins traitants.
                </p>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleDownloadExcel('patients')} disabled={exportingType === 'patients'}>
                <Download size={16} /> Exporter les Patients (Excel)
              </button>
            </div>

            {/* PDF Activity Report */}
            <div className="glass-card glass-card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: 'var(--danger)' }}>
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Rapport d'Activité PDF</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Document Officiel Structuré</span>
                  </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Générez et prévisualisez le bilan d'activité du cabinet avec indicateurs de performance.
                </p>
              </div>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleGeneratePdf} disabled={exportingType === 'pdf'}>
                <Eye size={16} /> Aperçu & Imprimer PDF
              </button>
            </div>

          </div>

          {/* Live PDF Interactive Document Previewer */}
          {pdfPreview && (
            <div className="glass-card animate-slide-in" style={{ border: '2px solid var(--primary)', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} /> Previsualisation du Document PDF d'Activité
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => {
                    const win = window.open('', '_blank');
                    win.document.write(pdfPreview);
                    win.document.close();
                    win.print();
                  }}>
                    <Printer size={14} /> Imprimer / Sauvegarder PDF
                  </button>
                  <button className="btn btn-outline" style={{ fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => setPdfPreview(null)}>
                    Fermer l'aperçu
                  </button>
                </div>
              </div>

              {/* Rendered HTML PDF Page view */}
              <div 
                style={{ background: '#ffffff', borderRadius: '8px', padding: '20px', color: '#1e293b', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', overflowX: 'auto' }}
                dangerouslySetInnerHTML={{ __html: pdfPreview }}
              />
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 6 : INTEGRATIONS */}
      {activeSubTab === 'software' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {syncMessage && (
            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: '8px', fontSize: '0.85rem' }}>
              <CheckCircle size={16} inline /> {syncMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--primary)" /> Logiciels Médicaux (Doctolib, Maiia, Weda, Hellodoc)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {integrationsData?.software.map((sw) => (
                  <div key={sw.name} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '0.85rem', display: 'block' }}>{sw.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{sw.category} {sw.pingMs ? `• Ping: ${sw.pingMs}ms` : ''}</span>
                    </div>
                    <span className={`badge ${sw.status === 'CONNECTED' ? 'badge-success' : 'badge-warning'}`}>
                      {sw.status}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline" style={{ width: '100%', marginTop: '14px', fontSize: '0.8rem' }} onClick={() => handleTriggerSync('Logiciels Médicaux')} disabled={syncing}>
                <RefreshCw size={14} /> Synchroniser les Agendas Médicaux
              </button>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="var(--secondary)" /> Sync Calendriers (Google, Outlook)
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {integrationsData?.calendars.map(c => (
                    <div key={c.name} style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>{c.name}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--success)' }}>✓ {c.status} ({c.totalEventsSynced} évènements)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={18} color="var(--warning)" /> Téléphonie VOIP (Ringover, Twilio, SIP)
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {integrationsData?.telephony.map(t => (
                    <div key={t.provider} style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <strong style={{ fontSize: '0.8rem', display: 'block' }}>{t.provider}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t.line || t.trunk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 7 & 9 : SÉCURITÉ & RGPD */}
      {activeSubTab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={20} color="var(--primary)" /> Traçabilité & Registre d'Audit des Accès RGPD
            </h3>
            <div style={{ flex: 1, maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {logs.map(log => (
                <div key={log.id} style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--primary)' }}>{log.action}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>Utilisateur: {log.user} | IP: {log.ip}</div>
                  <div style={{ color: 'var(--success)', fontSize: '0.72rem', marginTop: '2px' }}>✓ Conforme RGPD & HDS</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} color="var(--success)" /> Normes de Sécurité & Confidentialité
            </h3>

            {secStats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                <div style={{ padding: '12px', background: 'rgba(16,185,129,0.12)', border: '1px solid var(--success)', borderRadius: '8px' }}>
                  <strong>Conformité RGPD / HDS :</strong>
                  <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: '2px' }}>{secStats.rgpdComplianceStatus}</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong>Chiffrement des données :</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{secStats.encryption}</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong>Authentification forte :</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{secStats.authMethod}</div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <strong>Sauvegardes automatiques :</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>Dernière sauvegarde: {new Date(secStats.lastBackup).toLocaleString('fr-FR')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
