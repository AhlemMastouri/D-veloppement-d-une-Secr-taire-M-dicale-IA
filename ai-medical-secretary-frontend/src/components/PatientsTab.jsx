import React, { useState, useEffect } from 'react';
import { Search, User, Phone, Mail, Calendar, FileText, ClipboardList, Clock } from 'lucide-react';

export default function PatientsTab({ token }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Detail tabs: 'appointments' | 'calls' | 'dictations'
  const [detailTab, setDetailTab] = useState('appointments');

  const fetchPatients = async () => {
    setLoadingList(true);
    try {
      const url = search 
        ? `http://localhost:3000/api/v1/patients?search=${encodeURIComponent(search)}` 
        : 'http://localhost:3000/api/v1/patients';
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients);
        if (data.patients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(data.patients[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchPatientDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/patients/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatientDetails(data.patient);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [search, token]);

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientDetails(selectedPatientId);
    }
  }, [selectedPatientId, token]);

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Dossiers Patients</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Fiches d'informations administratives et historique médical</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '30px' }}>
        
        {/* Left column: Search and list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px', paddingRight: '12px', height: '40px' }}
                placeholder="Rechercher nom, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="glass-card" style={{ flex: 1, padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '14px', color: 'var(--text-secondary)' }}>Fiches Patients</h3>
            
            {loadingList ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Chargement...</div>
            ) : patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Aucun patient trouvé</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {patients.map((p) => (
                  <button
                    key={p.id}
                    className="btn btn-outline animate-slide-in"
                    style={{
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '12px',
                      background: selectedPatientId === p.id ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                      borderColor: selectedPatientId === p.id ? 'var(--primary)' : 'var(--border-color)',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setSelectedPatientId(p.id)}
                  >
                    <User size={16} color="var(--text-secondary)" style={{ marginRight: '8px' }} />
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>{p.lastName.toUpperCase()} {p.firstName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.phone}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Patient Details */}
        <div className="glass-card" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
          {loadingDetails ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Chargement des détails du dossier...
            </div>
          ) : !patientDetails ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Sélectionnez un patient à gauche pour voir son dossier.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Header card info */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
                <div style={{ height: '60px', width: '60px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                  <User size={30} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem' }}>{patientDetails.firstName} {patientDetails.lastName}</h3>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><Phone size={14} /> {patientDetails.phone}</span>
                    {patientDetails.email && <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><Mail size={14} /> {patientDetails.email}</span>}
                  </div>
                </div>
              </div>

              {/* Administrative metadata info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date de naissance</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{new Date(patientDetails.dob).toLocaleDateString('fr-FR')}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Couverture Assurance</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{patientDetails.insurance || 'Non renseignée'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Médecin traitant</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{patientDetails.treatingPhysician || 'Non assigné'}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consentement RGPD</span>
                  <span className={`badge ${patientDetails.consentGdpr ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '4px' }}>
                    {patientDetails.consentGdpr ? 'Oui' : 'Non'}
                  </span>
                </div>
              </div>

              {/* Detail section tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <button 
                  className="btn" 
                  style={{
                    background: 'transparent',
                    color: detailTab === 'appointments' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: detailTab === 'appointments' ? '2px solid var(--primary)' : 'none',
                    borderRadius: 0,
                    padding: '10px 16px',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => setDetailTab('appointments')}
                >
                  <Calendar size={16} /> Agenda ({patientDetails.appointments?.length || 0})
                </button>
                <button 
                  className="btn" 
                  style={{
                    background: 'transparent',
                    color: detailTab === 'calls' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: detailTab === 'calls' ? '2px solid var(--primary)' : 'none',
                    borderRadius: 0,
                    padding: '10px 16px',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => setDetailTab('calls')}
                >
                  <Phone size={16} /> Appels IA ({patientDetails.callLogs?.length || 0})
                </button>
                <button 
                  className="btn" 
                  style={{
                    background: 'transparent',
                    color: detailTab === 'dictations' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: detailTab === 'dictations' ? '2px solid var(--primary)' : 'none',
                    borderRadius: 0,
                    padding: '10px 16px',
                    fontSize: '0.9rem'
                  }}
                  onClick={() => setDetailTab('dictations')}
                >
                  <FileText size={16} /> Dictées ({patientDetails.dictations?.length || 0})
                </button>
              </div>

              {/* Detail lists */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                
                {/* 1. Appointments history */}
                {detailTab === 'appointments' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(!patientDetails.appointments || patientDetails.appointments.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Aucun rendez-vous enregistré.</p>
                    ) : (
                      patientDetails.appointments.map((appt) => (
                        <div key={appt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{new Date(appt.startTime).toLocaleString('fr-FR')}</span>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Médecin: {appt.doctor.name} ({appt.doctor.specialty})</span>
                            {appt.notes && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Motif: {appt.notes}</span>}
                          </div>
                          <span className={`badge ${appt.status === 'CONFIRMED' ? 'badge-success' : appt.status === 'CANCELLED' ? 'badge-danger' : 'badge-warning'}`} style={{ height: 'fit-content' }}>
                            {appt.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 2. Call Logs history */}
                {detailTab === 'calls' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(!patientDetails.callLogs || patientDetails.callLogs.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Aucun enregistrement d'appel.</p>
                    ) : (
                      patientDetails.callLogs.map((log) => (
                        <div key={log.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(log.startTime).toLocaleString('fr-FR')} ({log.duration}s)</span>
                            <span className={`badge ${log.classification === 'EMERGENCY' ? 'badge-danger' : log.classification === 'APPOINTMENT_BOOKING' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                              {log.classification || 'INCONNU'}
                            </span>
                          </div>
                          <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Résumé IA:</strong>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.summary || 'Pas de résumé'}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Medical Dictations drafts */}
                {detailTab === 'dictations' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(!patientDetails.dictations || patientDetails.dictations.length === 0) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>Aucune dictée médicale pour ce patient.</p>
                    ) : (
                      patientDetails.dictations.map((dic) => (
                        <div key={dic.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><Clock size={12} /> {new Date(dic.createdAt).toLocaleDateString('fr-FR')}</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>Export PDF disponible</span>
                          </div>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Compte-rendu clinique</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{dic.summary}</p>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Transcription brute</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{dic.rawTranscript}"</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
