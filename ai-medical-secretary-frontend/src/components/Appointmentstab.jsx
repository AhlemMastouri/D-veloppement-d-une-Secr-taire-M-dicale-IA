import React, { useState, useEffect } from 'react';
import { Calendar, User, Stethoscope, Filter, RefreshCw, CheckCircle, Clock, X } from 'lucide-react';

export default function AppointmentsTab({ token }) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isDoctor = currentUser.role === 'DOCTOR';

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    doctorId: isDoctor ? String(currentUser.id) : '',
    status: '',
    startDate: '',
    endDate: '',
  });

  const fetchDoctors = async () => {
    if (isDoctor) return; // Un médecin ne consulte que son propre agenda, pas besoin de la liste
    try {
      const res = await fetch('http://localhost:3001/api/v1/doctors', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      const doctorIdToUse = isDoctor ? String(currentUser.id) : filters.doctorId;
      if (doctorIdToUse) params.append('doctorId', doctorIdToUse);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const url = `http://localhost:3001/api/v1/appointments${params.toString() ? '?' + params.toString() : ''}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des rendez-vous');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau, veuillez réessayer.');
    } finally {
      setLoading(false);
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
        setError(data.error || 'Erreur lors de l\'annulation');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de l\'annulation');
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ─── Statut : libellé + icône + couleur, en français ───
  const statusInfo = (status) => {
    const map = {
      CONFIRMED: { cls: 'badge-success', label: 'Confirmé', icon: <CheckCircle size={12} /> },
      PENDING: { cls: 'badge-warning', label: 'En attente', icon: <Clock size={12} /> },
      CANCELLED: { cls: 'badge-danger', label: 'Annulé', icon: <X size={12} /> },
    };
    return map[status] || { cls: 'badge-warning', label: status, icon: null };
  };

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Rendez-vous</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isDoctor ? 'Vue d\'ensemble de vos rendez-vous' : 'Vue d\'ensemble de l\'agenda de la clinique'}
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchAppointments} disabled={loading}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'end' }}>
          {!isDoctor && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Médecin</label>
              <select
                className="form-control"
                style={{ minWidth: '180px' }}
                value={filters.doctorId}
                onChange={(e) => setFilters({ ...filters, doctorId: e.target.value })}
              >
                <option value="">Tous</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Statut</label>
            <select
              className="form-control"
              style={{ minWidth: '150px' }}
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Tous</option>
              <option value="CONFIRMED">Confirmé</option>
              <option value="PENDING">En attente</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Du</label>
            <input
              type="date"
              className="form-control"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Au</label>
            <input
              type="date"
              className="form-control"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          <button className="btn btn-primary" onClick={fetchAppointments}>
            <Filter size={16} /> Filtrer
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '0.85rem',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Liste des rendez-vous */}
      <div className="glass-card" style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chargement...</div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Aucun rendez-vous trouvé</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {appointments.map((appt) => {
              const badge = statusInfo(appt.status);
              return (
                <div
                  key={appt.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: '150px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
                        <Calendar size={14} /> {new Date(appt.startTime).toLocaleString('fr-FR')}
                      </span>
                    </div>

                    <div style={{ minWidth: '160px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <User size={14} color="var(--text-secondary)" />
                        {appt.patient?.firstName} {appt.patient?.lastName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{appt.patient?.phone}</span>
                    </div>

                    {!isDoctor && (
                      <div style={{ minWidth: '180px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <Stethoscope size={14} color="var(--text-secondary)" />
                          {appt.doctor?.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{appt.doctor?.specialty}</span>
                      </div>
                    )}

                    {appt.notes && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '220px' }}>
                        {appt.notes}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span className={`badge ${badge.cls}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {badge.icon} {badge.label}
                    </span>
                    {(appt.status === 'PENDING' || appt.status === 'CONFIRMED') && (
                      <button
                        className="btn btn-outline"
                        style={{ padding: '6px 10px', fontSize: '0.8rem' }}
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
  );
}