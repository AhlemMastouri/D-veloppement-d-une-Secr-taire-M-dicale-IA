import React, { useState, useEffect } from 'react';
import { Calendar, User, Clock, Plus, Trash2, ShieldAlert, CheckCircle } from 'lucide-react';

export default function CalendarTab({ token }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('1'); // Default Dr Dupont (ID 1)
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [selectedPatientId, setSelectedPatientId] = useState('1'); // Default Alice (ID 1)
  const [bookingNotes, setBookingNotes] = useState('Consultation de contrôle');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Sample static patients for the selection box (matches seeded DB IDs)
  const patientsList = [
    { id: '1', name: 'Alice Dubois' },
    { id: '2', name: 'Bob Lemoine' },
    { id: '3', name: 'Charlie Gerard' },
  ];

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/v1/appointments?doctorId=${selectedDoctor}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    
    // Set default date to tomorrow in form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split('T')[0]);
  }, [selectedDoctor, token]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');

    try {
      // Construct ISO string
      const startDateTimeStr = `${bookingDate}T${bookingTime}:00`;
      
      const response = await fetch('http://localhost:3000/api/v1/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: parseInt(selectedPatientId),
          doctorId: parseInt(selectedDoctor),
          startTime: new Date(startDateTimeStr).toISOString(),
          duration: 30,
          notes: bookingNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réservation');
      }

      setBookingSuccess('Rendez-vous réservé avec succès ! SMS envoyé au patient.');
      fetchAppointments();
      
      // Auto close modal after delay
      setTimeout(() => {
        setShowModal(false);
        setBookingSuccess('');
        setBookingNotes('Consultation de contrôle');
      }, 1500);
    } catch (err) {
      setBookingError(err.message);
    }
  };

  const handleCancelAppointment = async (id) => {
    if (!window.confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) return;

    try {
      const response = await fetch(`http://localhost:3000/api/v1/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'CANCELLED' })
      });

      if (response.ok) {
        fetchAppointments();
      }
    } catch (e) {
      console.error('Erreur annulation:', e);
    }
  };

  return (
    <div className="animate-slide-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Agenda Médical</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Consulter et modifier le planning des consultations et disponibilités</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Prendre un RDV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '30px' }}>
        
        {/* Doctor selector column */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Filtrer par Médecin</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="btn btn-outline" 
              style={{
                justifyContent: 'flex-start',
                background: selectedDoctor === '1' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                borderColor: selectedDoctor === '1' ? 'var(--primary)' : 'var(--border-color)',
              }}
              onClick={() => setSelectedDoctor('1')}
            >
              <User size={18} color="var(--primary)" />
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem', textAlign: 'left' }}>Dr. Jean Dupont</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Généraliste</span>
              </div>
            </button>

            <button 
              className="btn btn-outline" 
              style={{
                justifyContent: 'flex-start',
                background: selectedDoctor === '2' ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                borderColor: selectedDoctor === '2' ? 'var(--primary)' : 'var(--border-color)',
              }}
              onClick={() => setSelectedDoctor('2')}
            >
              <User size={18} color="var(--secondary)" />
              <div>
                <strong style={{ display: 'block', fontSize: '0.85rem', textAlign: 'left' }}>Dr. Sophie Lefèvre</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pédiatrie</span>
              </div>
            </button>
          </div>
        </div>

        {/* Appointments lists */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.20rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary)" />
            Rendez-vous planifiés
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              Chargement des rendez-vous...
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucun rendez-vous planifié pour ce médecin dans les prochains jours.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {appointments.map((appt) => {
                const dateObj = new Date(appt.startTime);
                const isCancelled = appt.status === 'CANCELLED';

                return (
                  <div 
                    key={appt.id} 
                    className="glass-card-hover"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isCancelled ? 'rgba(239, 68, 68, 0.05)' : 'rgba(30, 41, 59, 0.25)',
                      border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      opacity: isCancelled ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center', paddingRight: '20px', borderRight: '1px solid var(--border-color)' }}>
                        <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 800 }}>
                          {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          {dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(appt.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.95rem' }}>{appt.patient.firstName} {appt.patient.lastName}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{appt.notes || 'Aucune note spécifique'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span className={`badge ${isCancelled ? 'badge-danger' : appt.status === 'PENDING' ? 'badge-warning' : 'badge-success'}`}>
                        {appt.status}
                      </span>
                      {!isCancelled && (
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => handleCancelAppointment(appt.id)}
                          title="Annuler le rendez-vous"
                        >
                          <Trash2 size={16} />
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

      {/* Booking Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '500px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Prendre un Rendez-vous</h3>

            {bookingError && (
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
                <ShieldAlert size={16} />
                {bookingError}
              </div>
            )}

            {bookingSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: 'var(--success)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <CheckCircle size={16} />
                {bookingSuccess}
              </div>
            )}

            <form onSubmit={handleBookAppointment}>
              <div className="form-group">
                <label className="form-label">Patient</label>
                <select 
                  className="form-control"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {patientsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Heure</label>
                  <select 
                    className="form-control"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  >
                    <option value="09:00">09:00</option>
                    <option value="09:30">09:30</option>
                    <option value="10:00">10:00</option>
                    <option value="10:30">10:30</option>
                    <option value="11:00">11:00</option>
                    <option value="11:30">11:30</option>
                    <option value="14:00">14:00</option>
                    <option value="14:30">14:30</option>
                    <option value="15:00">15:00</option>
                    <option value="15:30">15:30</option>
                    <option value="16:00">16:00</option>
                    <option value="16:30">16:30</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Motif de consultation</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  placeholder="Ex: Consultation pédiatrique, grippe..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmer</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
