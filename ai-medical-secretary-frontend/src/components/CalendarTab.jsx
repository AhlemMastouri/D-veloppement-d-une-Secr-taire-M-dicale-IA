import React, { useState, useEffect } from 'react';
import { Calendar, User, Clock, Plus, Trash2, ShieldAlert, CheckCircle, Edit3, X, AlertTriangle, Stethoscope, Phone, FileText } from 'lucide-react';

export default function CalendarTab({ token }) {
  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isPatient = currentUser.role === 'PATIENT';
  const isDoctor = currentUser.role === 'DOCTOR';
  const isStaff = !isPatient && !isDoctor; // SECRETARY / ADMIN

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Pour un médecin, le "médecin sélectionné" est toujours lui-même, non modifiable.
  const [selectedDoctor, setSelectedDoctor] = useState(isDoctor ? String(currentUser.id) : '1');
  const [doctors, setDoctors] = useState([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [bookingNotes, setBookingNotes] = useState('Consultation de contrôle');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState(isDoctor ? String(currentUser.id) : '1');

  // Reschedule modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('09:00');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSuccess, setRescheduleSuccess] = useState('');

  // Patients list for staff booking
  const [patientsList, setPatientsList] = useState([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');

  const fetchDoctors = async () => {
    if (isDoctor) return; // Un médecin n'a pas besoin de la liste des autres médecins
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

  const fetchPatients = async () => {
    if (isPatient || isDoctor) return; // Seul le staff a besoin de choisir un patient pour réserver
    try {
      const res = await fetch('http://localhost:3001/api/v1/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatientsList(data.patients || []);
        if (data.patients && data.patients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(String(data.patients[0].id));
        }
      }
    } catch (e) {
      console.error(e);
      // Fallback static list
      setPatientsList([
        { id: 1, firstName: 'Alice', lastName: 'Dubois' },
        { id: 2, firstName: 'Bob', lastName: 'Lemoine' },
        { id: 3, firstName: 'Charlie', lastName: 'Gerard' },
      ]);
      if (!selectedPatientId) setSelectedPatientId('1');
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      // Patients : le backend filtre automatiquement par leur ID.
      // Médecins : toujours filtré par leur propre ID (non modifiable).
      // Staff : filtré par le médecin sélectionné dans la liste.
      if (!isPatient) {
        params.append('doctorId', isDoctor ? String(currentUser.id) : selectedDoctor);
      }
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const url = `http://localhost:3001/api/v1/appointments${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau, veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchPatients();
    // Set default date to tomorrow in form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split('T')[0]);
  }, [token]);

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, statusFilter, token]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');

    try {
      const startDateTimeStr = `${bookingDate}T${bookingTime}:00`;
      const body = {
        doctorId: parseInt(selectedDoctorForBooking),
        startTime: new Date(startDateTimeStr).toISOString(),
        duration: 30,
        notes: bookingNotes
      };

      // If patient, use their own ID; if staff, use selected patient
      if (isPatient) {
        body.patientId = currentUser.id;
      } else {
        body.patientId = parseInt(selectedPatientId);
      }

      const response = await fetch('http://localhost:3001/api/v1/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réservation');
      }

      setBookingSuccess('Rendez-vous réservé avec succès !');
      fetchAppointments();

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
      // Try POST /cancel first, fallback to PATCH
      let response = await fetch(`http://localhost:3001/api/v1/appointments/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // If the /cancel endpoint doesn't exist, fallback to PATCH
      if (response.status === 404) {
        response = await fetch(`http://localhost:3001/api/v1/appointments/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'CANCELLED' })
        });
      }

      if (response.ok) {
        fetchAppointments();
      } else {
        const data = await response.json();
        setError(data.error || "Erreur lors de l'annulation");
      }
    } catch (e) {
      console.error('Erreur annulation:', e);
      setError("Erreur réseau lors de l'annulation");
    }
  };

  const handleConfirmAppointment = async (id) => {
    try {
      const response = await fetch(`http://localhost:3001/api/v1/appointments/${id}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchAppointments();
      } else {
        const data = await response.json();
        setError(data.error || 'Impossible de valider ce rendez-vous');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de la validation');
    }
  };

  const openRescheduleModal = (appt) => {
    setRescheduleAppt(appt);
    const dateObj = new Date(appt.startTime);
    setRescheduleDate(dateObj.toISOString().split('T')[0]);
    setRescheduleTime(dateObj.toTimeString().slice(0, 5));
    setRescheduleError('');
    setRescheduleSuccess('');
    setShowRescheduleModal(true);
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    setRescheduleError('');
    setRescheduleSuccess('');

    try {
      const startDateTimeStr = `${rescheduleDate}T${rescheduleTime}:00`;
      const response = await fetch(`http://localhost:3001/api/v1/appointments/${rescheduleAppt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startTime: new Date(startDateTimeStr).toISOString(),
          duration: 30
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du déplacement');
      }

      setRescheduleSuccess('Rendez-vous déplacé avec succès !');
      fetchAppointments();
      setTimeout(() => {
        setShowRescheduleModal(false);
        setRescheduleSuccess('');
      }, 1500);
    } catch (err) {
      setRescheduleError(err.message);
    }
  };

  const statusBadge = (status) => {
    const map = {
      'CONFIRMED': { cls: 'badge-success', label: 'Confirmé', icon: <CheckCircle size={12} /> },
      'PENDING': { cls: 'badge-warning', label: 'En attente', icon: <Clock size={12} /> },
      'CANCELLED': { cls: 'badge-danger', label: 'Annulé', icon: <X size={12} /> },
    };
    return map[status] || { cls: 'badge-warning', label: status, icon: null };
  };

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
  ];

  const statusFilterBar = (
    <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
            background: statusFilter === f.val ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
            borderColor: statusFilter === f.val ? 'var(--primary)' : 'var(--border-color)',
            color: statusFilter === f.val ? 'var(--primary)' : 'var(--text-secondary)'
          }}
          onClick={() => setStatusFilter(f.val)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  // ─── PATIENT VIEW ───
  if (isPatient) {
    const upcomingAppts = appointments.filter(a => a.status !== 'CANCELLED' && new Date(a.startTime) >= new Date());

    return (
      <div className="animate-slide-in">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Mes Rendez-vous</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Consultez, modifiez ou annulez vos rendez-vous médicaux</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Prendre un RDV
          </button>
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

        {/* Stats summary cards for patient */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
            <div style={{ padding: '10px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
              <Calendar size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Total RDV</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{appointments.length}</span>
            </div>
          </div>

          <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
            <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--success)' }}>
              <CheckCircle size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>À venir</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{upcomingAppts.length}</span>
            </div>
          </div>

          <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: 'var(--danger)' }}>
              <X size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Annulés</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{appointments.filter(a => a.status === 'CANCELLED').length}</span>
            </div>
          </div>
        </div>

        {statusFilterBar}

        {/* Appointments list */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary)" />
            {statusFilter === 'CANCELLED' ? 'Rendez-vous annulés' : 'Mes rendez-vous'}
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
              Chargement de vos rendez-vous...
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              <Calendar size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Aucun rendez-vous trouvé</p>
              <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Cliquez sur « Prendre un RDV » pour réserver votre première consultation.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {appointments.map((appt) => {
                const dateObj = new Date(appt.startTime);
                const endObj = new Date(appt.endTime);
                const isCancelled = appt.status === 'CANCELLED';
                const isPast = dateObj < new Date();
                const badge = statusBadge(appt.status);

                return (
                  <div
                    key={appt.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isCancelled ? 'rgba(239, 68, 68, 0.04)' : 'rgba(30, 41, 59, 0.25)',
                      border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      opacity: isCancelled ? 0.55 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                      {/* Date block */}
                      <div style={{ textAlign: 'center', paddingRight: '20px', borderRight: '1px solid var(--border-color)', minWidth: '65px' }}>
                        <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 800 }}>
                          {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                          {dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </span>
                      </div>

                      {/* Details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Clock size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Stethoscope size={14} color="var(--primary)" />
                          <strong style={{ fontSize: '0.9rem' }}>
                            {appt.doctor?.name || 'Médecin'}
                          </strong>
                          {appt.doctor?.specialty && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                              {appt.doctor.specialty}
                            </span>
                          )}
                        </div>
                        {appt.notes && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <FileText size={12} />
                            {appt.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge ${badge.cls}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {badge.icon} {badge.label}
                      </span>

                      {!isCancelled && !isPast && (
                        <>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                            onClick={() => openRescheduleModal(appt)}
                            title="Modifier la date/heure"
                          >
                            <Edit3 size={14} /> Modifier
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            onClick={() => handleCancelAppointment(appt.id)}
                            title="Annuler le rendez-vous"
                          >
                            <Trash2 size={14} /> Annuler
                          </button>
                        </>
                      )}
                      {isPast && !isCancelled && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Terminé</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Patient Booking Modal */}
        {showModal && renderBookingModal()}
        {/* Reschedule Modal */}
        {showRescheduleModal && renderRescheduleModal()}
      </div>
    );
  }

  // ─── DOCTOR VIEW : uniquement son propre planning, sans sélecteur ni réservation ───
  if (isDoctor) {
    return (
      <div className="animate-slide-in">
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Mon Planning</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Consultez et validez vos rendez-vous à venir</p>
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

        {statusFilterBar}

        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary)" />
            Rendez-vous
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({appointments.length} résultat{appointments.length !== 1 ? 's' : ''})
            </span>
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
              Chargement de votre planning...
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              <Calendar size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Aucun rendez-vous trouvé</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {appointments.map((appt) => {
                const dateObj = new Date(appt.startTime);
                const isCancelled = appt.status === 'CANCELLED';
                const badge = statusBadge(appt.status);

                return (
                  <div
                    key={appt.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isCancelled ? 'rgba(239, 68, 68, 0.05)' : 'rgba(30, 41, 59, 0.25)',
                      border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      opacity: isCancelled ? 0.6 : 1,
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
                            {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(appt.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <User size={14} color="var(--text-secondary)" />
                          <strong style={{ fontSize: '0.9rem' }}>
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </strong>
                          {appt.patient?.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={11} /> {appt.patient.phone}
                            </span>
                          )}
                        </div>
                        {appt.notes && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <FileText size={12} /> {appt.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge ${badge.cls}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {badge.icon} {badge.label}
                      </span>
                      {appt.status === 'PENDING' && (
                        <>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                            onClick={() => handleConfirmAppointment(appt.id)}
                            title="Valider le rendez-vous"
                          >
                            <CheckCircle size={14} /> Valider
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            onClick={() => handleCancelAppointment(appt.id)}
                            title="Refuser le rendez-vous"
                          >
                            <X size={14} /> Refuser
                          </button>
                        </>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                            onClick={() => openRescheduleModal(appt)}
                            title="Déplacer le rendez-vous à une autre date/heure"
                          >
                            <Edit3 size={14} /> Déplacer
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            onClick={() => handleCancelAppointment(appt.id)}
                            title="Annuler définitivement ce rendez-vous"
                          >
                            <Trash2 size={14} /> Annuler
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reschedule Modal (le médecin peut déplacer un RDV confirmé) */}
        {showRescheduleModal && renderRescheduleModal()}
      </div>
    );
  }

  // ─── STAFF VIEW (secrétaire / admin) : sélecteur de médecin + réservation ───
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

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '30px' }}>

        {/* Doctor selector column */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Filtrer par Médecin</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {doctors.length > 0 ? doctors.map(doc => (
              <button
                key={doc.id}
                className="btn btn-outline"
                style={{
                  justifyContent: 'flex-start',
                  background: selectedDoctor === String(doc.id) ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                  borderColor: selectedDoctor === String(doc.id) ? 'var(--primary)' : 'var(--border-color)',
                }}
                onClick={() => setSelectedDoctor(String(doc.id))}
              >
                <User size={18} color="var(--primary)" />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem', textAlign: 'left' }}>{doc.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{doc.specialty || 'Médecin'}</span>
                </div>
              </button>
            )) : (
              <>
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
              </>
            )}
          </div>

          {/* Status filter for staff */}
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '10px' }}>Statut :</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { val: '', label: 'Tous' },
                { val: 'PENDING', label: 'En attente' },
                { val: 'CONFIRMED', label: 'Confirmés' },
                { val: 'CANCELLED', label: 'Annulés' },
              ].map(f => (
                <button
                  key={f.val}
                  className="btn btn-outline"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    justifyContent: 'flex-start',
                    background: statusFilter === f.val ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                    borderColor: statusFilter === f.val ? 'var(--primary)' : 'var(--border-color)',
                    color: statusFilter === f.val ? 'var(--primary)' : 'var(--text-secondary)',
                    border: 'none'
                  }}
                  onClick={() => setStatusFilter(f.val)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Appointments list */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.20rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary)" />
            Rendez-vous planifiés
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({appointments.length} résultat{appointments.length !== 1 ? 's' : ''})
            </span>
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              Chargement des rendez-vous...
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucun rendez-vous planifié pour ce médecin.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {appointments.map((appt) => {
                const dateObj = new Date(appt.startTime);
                const isCancelled = appt.status === 'CANCELLED';
                const badge = statusBadge(appt.status);

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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <User size={14} color="var(--text-secondary)" />
                          <strong style={{ fontSize: '0.95rem' }}>
                            {appt.patient?.firstName} {appt.patient?.lastName}
                          </strong>
                          {appt.patient?.phone && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Phone size={11} /> {appt.patient.phone}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{appt.notes || 'Aucune note spécifique'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`badge ${badge.cls}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {badge.icon} {badge.label}
                      </span>
                      {appt.status === 'PENDING' && (
                        <button
                          className="btn btn-outline"
                          style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          onClick={() => handleConfirmAppointment(appt.id)}
                          title="Valider le rendez-vous"
                        >
                          <CheckCircle size={14} /> Valider
                        </button>
                      )}
                      {!isCancelled && (
                        <>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem' }}
                            onClick={() => openRescheduleModal(appt)}
                            title="Déplacer le rendez-vous à une autre date/heure"
                          >
                            <Edit3 size={14} /> Déplacer
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)' }}
                            onClick={() => handleCancelAppointment(appt.id)}
                            title="Annuler définitivement ce rendez-vous"
                          >
                            <Trash2 size={14} /> Annuler
                          </button>
                        </>
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
      {showModal && renderBookingModal()}
      {/* Reschedule Modal */}
      {showRescheduleModal && renderRescheduleModal()}
    </div>
  );

  // ─── Shared Booking Modal ───
  function renderBookingModal() {
    return (
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
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px' }}>
            {isPatient ? 'Prendre un Rendez-vous' : 'Réserver un Rendez-vous'}
          </h3>

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
            {/* Patient selector (staff only) */}
            {!isPatient && (
              <div className="form-group">
                <label className="form-label">Patient</label>
                <select
                  className="form-control"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {patientsList.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Doctor selector */}
            <div className="form-group">
              <label className="form-label">Médecin</label>
              <select
                className="form-control"
                value={selectedDoctorForBooking}
                onChange={(e) => setSelectedDoctorForBooking(e.target.value)}
              >
                {doctors.length > 0 ? doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} — {d.specialty || 'Médecin'}</option>
                )) : (
                  <>
                    <option value="1">Dr. Jean Dupont — Généraliste</option>
                    <option value="2">Dr. Sophie Lefèvre — Pédiatrie</option>
                  </>
                )}
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
                  {timeSlots.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
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
                placeholder="Ex: Consultation générale, suivi, grippe..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmer</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setBookingError(''); setBookingSuccess(''); }}>Annuler</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ─── Shared Reschedule Modal ───
  function renderRescheduleModal() {
    return (
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
        <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '460px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={20} color="var(--primary)" />
            Modifier le rendez-vous
          </h3>

          {rescheduleError && (
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
              {rescheduleError}
            </div>
          )}

          {rescheduleSuccess && (
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
              {rescheduleSuccess}
            </div>
          )}

          {rescheduleAppt && (
            <div style={{
              background: 'rgba(14, 165, 233, 0.06)',
              border: '1px solid rgba(14, 165, 233, 0.15)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '18px',
              fontSize: '0.85rem'
            }}>
              <strong>RDV actuel :</strong> {new Date(rescheduleAppt.startTime).toLocaleString('fr-FR')}
              <br />
              <span style={{ color: 'var(--text-secondary)' }}>
                {isPatient
                  ? `Dr. ${rescheduleAppt.doctor?.name || ''}`
                  : `${rescheduleAppt.patient?.firstName || ''} ${rescheduleAppt.patient?.lastName || ''}`
                }
              </span>
            </div>
          )}

          <form onSubmit={handleReschedule}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nouvelle date</label>
                <input
                  type="date"
                  className="form-control"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nouvelle heure</label>
                <select
                  className="form-control"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                >
                  {timeSlots.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Déplacer le RDV</button>
              <button type="button" className="btn btn-outline" onClick={() => { setShowRescheduleModal(false); setRescheduleError(''); }}>Annuler</button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}