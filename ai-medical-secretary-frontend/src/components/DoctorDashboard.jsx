import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, CheckCircle, Phone, Plus, Trash2, AlertTriangle,
  User, FileText, PhoneCall, CalendarClock, X, Pencil
} from 'lucide-react';

const DAYS = [
  { val: 0, label: 'Dimanche' },
  { val: 1, label: 'Lundi' },
  { val: 2, label: 'Mardi' },
  { val: 3, label: 'Mercredi' },
  { val: 4, label: 'Jeudi' },
  { val: 5, label: 'Vendredi' },
  { val: 6, label: 'Samedi' },
];

const EMPTY_AVAIL_FORM = {
  dayOfWeek: '1',
  specificDate: '',
  startTime: '09:00',
  endTime: '17:00',
  isAvailable: true,
};

export default function DoctorDashboard({ token }) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const doctorId = currentUser.id;

  const [activeTab, setActiveTab] = useState('planning');
  const [error, setError] = useState('');

  // ─── Planning ───
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [apptStatusFilter, setApptStatusFilter] = useState('');

  const fetchAppointments = async () => {
    setLoadingAppts(true);
    setError('');
    try {
      const params = new URLSearchParams({ doctorId: String(doctorId) });
      if (apptStatusFilter) params.append('status', apptStatusFilter);

      const res = await fetch(`http://localhost:3001/api/v1/appointments?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement du planning');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingAppts(false);
    }
  };

  const confirmAppointment = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/appointments/${id}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAppointments();
      } else {
        const data = await res.json();
        setError(data.error || 'Impossible de valider ce rendez-vous');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de la validation');
    }
  };

  const cancelAppointment = async (id) => {
    if (!window.confirm('Annuler ce rendez-vous ?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/v1/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAppointments();
      } else {
        const data = await res.json();
        setError(data.error || 'Impossible d\'annuler ce rendez-vous');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de l\'annulation');
    }
  };

  // ─── Appels IA ───
  const [callLogs, setCallLogs] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  const fetchCallLogs = async () => {
    setLoadingCalls(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/v1/call-logs?doctorId=${doctorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCallLogs(data.callLogs || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des appels IA');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingCalls(false);
    }
  };

  // ─── Disponibilités ───
  const [availabilities, setAvailabilities] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [showAvailForm, setShowAvailForm] = useState(false);
  const [availMode, setAvailMode] = useState('recurring'); // 'recurring' | 'specific'
  const [editingAvailId, setEditingAvailId] = useState(null); // null = création, sinon id en cours d'édition
  const [availForm, setAvailForm] = useState(EMPTY_AVAIL_FORM);
  const [availError, setAvailError] = useState('');

  const fetchAvailabilities = async () => {
    setLoadingAvail(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/v1/availabilities?doctorId=${doctorId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailabilities(data.availabilities || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des disponibilités');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingAvail(false);
    }
  };

  const openCreateAvailForm = () => {
    setEditingAvailId(null);
    setAvailMode('recurring');
    setAvailForm(EMPTY_AVAIL_FORM);
    setAvailError('');
    setShowAvailForm(true);
  };

  const openEditAvailForm = (av) => {
    setEditingAvailId(av.id);
    setAvailMode(av.specificDate ? 'specific' : 'recurring');
    setAvailForm({
      dayOfWeek: av.dayOfWeek != null ? String(av.dayOfWeek) : '1',
      specificDate: av.specificDate ? av.specificDate.slice(0, 10) : '',
      startTime: av.startTime,
      endTime: av.endTime,
      isAvailable: av.isAvailable,
    });
    setAvailError('');
    setShowAvailForm(true);
  };

  const closeAvailForm = () => {
    setShowAvailForm(false);
    setEditingAvailId(null);
    setAvailForm(EMPTY_AVAIL_FORM);
    setAvailError('');
  };

  const saveAvailability = async (e) => {
    e.preventDefault();
    setAvailError('');

    if (!availForm.startTime || !availForm.endTime) {
      setAvailError('Heure de début et de fin requises.');
      return;
    }
    if (availForm.startTime >= availForm.endTime) {
      setAvailError('L\'heure de fin doit être après l\'heure de début.');
      return;
    }
    if (availMode === 'specific' && !availForm.specificDate) {
      setAvailError('Veuillez choisir une date spécifique.');
      return;
    }

    try {
      const body = {
        doctorId,
        startTime: availForm.startTime,
        endTime: availForm.endTime,
        isAvailable: availForm.isAvailable,
      };
      if (availMode === 'recurring') {
        body.dayOfWeek = parseInt(availForm.dayOfWeek);
        body.specificDate = null;
      } else {
        body.specificDate = availForm.specificDate;
        body.dayOfWeek = null;
      }

      const isEditing = Boolean(editingAvailId);
      const url = isEditing
        ? `http://localhost:3001/api/v1/availabilities/${editingAvailId}`
        : 'http://localhost:3001/api/v1/availabilities';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (res.ok) {
        closeAvailForm();
        fetchAvailabilities();
      } else {
        setAvailError(data.error || `Erreur lors de ${isEditing ? 'la modification' : 'la création'} de la disponibilité`);
      }
    } catch (e) {
      console.error(e);
      setAvailError('Erreur réseau');
    }
  };

  const deleteAvailability = async (id) => {
    if (!window.confirm('Supprimer ce créneau de disponibilité ?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/v1/availabilities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAvailabilities();
      } else {
        const data = await res.json();
        setError(data.error || 'Impossible de supprimer ce créneau');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de la suppression');
    }
  };

  const toggleAvailabilityActive = async (av) => {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/availabilities/${av.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctorId,
          startTime: av.startTime,
          endTime: av.endTime,
          dayOfWeek: av.dayOfWeek,
          specificDate: av.specificDate,
          isAvailable: !av.isAvailable,
        })
      });
      if (res.ok) {
        fetchAvailabilities();
      } else {
        const data = await res.json();
        setError(data.error || 'Impossible de mettre à jour ce créneau');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    }
  };

  useEffect(() => {
    if (activeTab === 'planning') fetchAppointments();
    if (activeTab === 'calls') fetchCallLogs();
    if (activeTab === 'availability') fetchAvailabilities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, apptStatusFilter, token]);

  const statusBadge = (status) => {
    const map = {
      CONFIRMED: { cls: 'badge-success', label: 'Confirmé' },
      PENDING: { cls: 'badge-warning', label: 'En attente' },
      CANCELLED: { cls: 'badge-danger', label: 'Annulé' },
    };
    return map[status] || { cls: 'badge-warning', label: status };
  };

  const classificationBadge = (cls) => {
    if (cls === 'EMERGENCY') return 'badge-danger';
    if (cls === 'APPOINTMENT_BOOKING') return 'badge-primary';
    return 'badge-warning';
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Espace Médecin</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Planning, appels IA et gestion de vos disponibilités
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        {[
          { id: 'planning', label: 'Planning', icon: <Calendar size={16} /> },
          { id: 'calls', label: 'Appels IA', icon: <PhoneCall size={16} /> },
          { id: 'availability', label: 'Disponibilités', icon: <CalendarClock size={16} /> },
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
          alignItems: 'center'
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ─── PLANNING ─── */}
      {activeTab === 'planning' && (
        <div>
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filtrer :</span>
            {[
              { val: '', label: 'Tous' },
              { val: 'PENDING', label: 'En attente' },
              { val: 'CONFIRMED', label: 'Confirmés' },
              { val: 'CANCELLED', label: 'Annulés' }
            ].map(f => (
              <button
                key={f.val}
                className="btn btn-outline"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  background: apptStatusFilter === f.val ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                  borderColor: apptStatusFilter === f.val ? 'var(--primary)' : 'var(--border-color)',
                  color: apptStatusFilter === f.val ? 'var(--primary)' : 'var(--text-secondary)'
                }}
                onClick={() => setApptStatusFilter(f.val)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            {loadingAppts ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
            ) : appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                Aucun rendez-vous trouvé.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {appointments.map((appt) => {
                  const dateObj = new Date(appt.startTime);
                  const badge = statusBadge(appt.status);
                  return (
                    <div
                      key={appt.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center', paddingRight: '20px', borderRight: '1px solid var(--border-color)', minWidth: '65px' }}>
                          <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800 }}>
                            {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Clock size={14} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                              {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <User size={14} color="var(--text-secondary)" />
                            <strong style={{ fontSize: '0.9rem' }}>{appt.patient?.firstName} {appt.patient?.lastName}</strong>
                          </div>
                          {appt.notes && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <FileText size={12} /> {appt.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        {appt.status === 'PENDING' && (
                          <>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                              onClick={() => confirmAppointment(appt.id)}
                            >
                              <CheckCircle size={14} /> Valider
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                              onClick={() => cancelAppointment(appt.id)}
                            >
                              <X size={14} /> Refuser
                            </button>
                          </>
                        )}
                        {appt.status === 'CONFIRMED' && (
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            onClick={() => cancelAppointment(appt.id)}
                          >
                            <X size={14} /> Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── APPELS IA ─── */}
      {activeTab === 'calls' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {loadingCalls ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
          ) : callLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucun appel IA enregistré.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {callLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '16px',
                    background: 'rgba(30, 41, 59, 0.25)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      <Phone size={14} color="var(--text-secondary)" />
                      {new Date(log.startTime).toLocaleString('fr-FR')} ({log.duration}s)
                    </span>
                    <span className={`badge ${classificationBadge(log.classification)}`}>
                      {log.classification || 'INCONNU'}
                    </span>
                  </div>
                  {log.patient && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Patient : {log.patient.firstName} {log.patient.lastName}
                    </span>
                  )}
                  <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Résumé IA :</strong>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.summary || 'Pas de résumé'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── DISPONIBILITÉS ─── */}
      {activeTab === 'availability' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn btn-primary" onClick={openCreateAvailForm}>
              <Plus size={16} /> Ajouter un créneau
            </button>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            {loadingAvail ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
            ) : availabilities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                Aucune disponibilité définie.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availabilities.map((av) => (
                  <div
                    key={av.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px',
                      background: av.isAvailable ? 'rgba(30, 41, 59, 0.25)' : 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <CalendarClock size={18} color="var(--primary)" />
                      <div>
                        <strong style={{ fontSize: '0.9rem' }}>
                          {av.specificDate
                            ? new Date(av.specificDate).toLocaleDateString('fr-FR')
                            : DAYS.find(d => d.val === av.dayOfWeek)?.label || `Jour ${av.dayOfWeek}`}
                        </strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {av.startTime} - {av.endTime}
                        </span>
                      </div>
                      {!av.isAvailable && <span className="badge badge-danger">Indisponible</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '7px 10px', fontSize: '0.75rem' }}
                        onClick={() => toggleAvailabilityActive(av)}
                      >
                        {av.isAvailable ? 'Marquer indisponible' : 'Réactiver'}
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '7px 10px', color: 'var(--primary)', borderColor: 'rgba(14, 165, 233, 0.3)' }}
                        onClick={() => openEditAvailForm(av)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '7px 10px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        onClick={() => deleteAvailability(av.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Créer / Modifier une disponibilité */}
      {showAvailForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>
                {editingAvailId ? 'Modifier le créneau' : 'Nouveau créneau de disponibilité'}
              </h3>
              <button className="btn btn-outline" style={{ padding: '6px' }} onClick={closeAvailForm}>
                <X size={16} />
              </button>
            </div>

            {availError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '14px'
              }}>
                {availError}
              </div>
            )}

            <form onSubmit={saveAvailability}>
              <div className="form-group">
                <label className="form-label">Type de créneau</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      background: availMode === 'recurring' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                      borderColor: availMode === 'recurring' ? 'var(--primary)' : 'var(--border-color)'
                    }}
                    onClick={() => setAvailMode('recurring')}
                  >
                    Récurrent (jour de semaine)
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      background: availMode === 'specific' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                      borderColor: availMode === 'specific' ? 'var(--primary)' : 'var(--border-color)'
                    }}
                    onClick={() => setAvailMode('specific')}
                  >
                    Date spécifique
                  </button>
                </div>
              </div>

              {availMode === 'recurring' ? (
                <div className="form-group">
                  <label className="form-label">Jour de la semaine</label>
                  <select
                    className="form-control"
                    value={availForm.dayOfWeek}
                    onChange={(e) => setAvailForm({ ...availForm, dayOfWeek: e.target.value })}
                  >
                    {DAYS.map(d => (
                      <option key={d.val} value={d.val}>{d.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={availForm.specificDate}
                    onChange={(e) => setAvailForm({ ...availForm, specificDate: e.target.value })}
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Heure de début</label>
                  <input
                    type="time"
                    className="form-control"
                    value={availForm.startTime}
                    onChange={(e) => setAvailForm({ ...availForm, startTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Heure de fin</label>
                  <input
                    type="time"
                    className="form-control"
                    value={availForm.endTime}
                    onChange={(e) => setAvailForm({ ...availForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={availForm.isAvailable}
                    onChange={(e) => setAvailForm({ ...availForm, isAvailable: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Créneau disponible (décoché = indisponible)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingAvailId ? 'Enregistrer les modifications' : 'Ajouter'}
                </button>
                <button type="button" className="btn btn-outline" onClick={closeAvailForm}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}