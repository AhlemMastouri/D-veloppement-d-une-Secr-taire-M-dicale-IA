import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, User, Clock, Plus, Trash2, ShieldAlert, CheckCircle, Edit3, X,
  AlertTriangle, Stethoscope, Phone, FileText, Filter, Search, RefreshCw,
  ChevronDown, ChevronUp
} from 'lucide-react';

const API = 'http://localhost:3001/api/v1';

export default function CalendarTab({ token }) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isPatient = currentUser.role === 'PATIENT';
  const isDoctor  = currentUser.role === 'DOCTOR';

  // ── Data ──────────────────────────────────────────────────────────────────
  const [appointments, setAppointments]   = useState([]);
  const [doctors, setDoctors]             = useState([]);
  const [patientsList, setPatientsList]   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterDoctor,  setFilterDoctor]  = useState(isDoctor ? String(currentUser.id) : '');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [filterHourFrom, setFilterHourFrom] = useState('');
  const [filterHourTo,   setFilterHourTo]   = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [showFilters,    setShowFilters]    = useState(false);

  // ── Booking modal ─────────────────────────────────────────────────────────
  const [showModal, setShowModal]             = useState(false);
  const [bookingDoctor,  setBookingDoctor]    = useState('');
  const [bookingDate,    setBookingDate]      = useState('');
  const [bookingTime,    setBookingTime]      = useState('09:00');
  const [bookingNotes,   setBookingNotes]     = useState('Consultation de contrôle');
  const [bookingPatient, setBookingPatient]   = useState('');
  const [bookingError,   setBookingError]     = useState('');
  const [bookingSuccess, setBookingSuccess]   = useState('');
  const [availableSlots, setAvailableSlots]   = useState([]);
  const [loadingSlots,   setLoadingSlots]     = useState(false);

  // ── Reschedule modal ──────────────────────────────────────────────────────
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppt,      setRescheduleAppt]      = useState(null);
  const [rescheduleDate,      setRescheduleDate]      = useState('');
  const [rescheduleTime,      setRescheduleTime]      = useState('09:00');
  const [rescheduleSlots,     setRescheduleSlots]     = useState([]);
  const [rescheduleError,     setRescheduleError]     = useState('');
  const [rescheduleSuccess,   setRescheduleSuccess]   = useState('');

  const timeSlots = [
    '07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
    '11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30',
    '16:00','16:30','17:00','17:30','18:00',
  ];

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch(`${API}/doctors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setDoctors(d.doctors || []);
        if (!bookingDoctor && d.doctors?.length > 0) {
          setBookingDoctor(String(d.doctors[0].id));
        }
      }
    } catch (e) { console.error(e); }
  }, [token]);

  const fetchPatients = useCallback(async () => {
    if (isPatient) return;
    try {
      const res = await fetch(`${API}/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setPatientsList(d.patients || []);
        if (!bookingPatient && d.patients?.length > 0) {
          setBookingPatient(String(d.patients[0].id));
        }
      }
    } catch (e) { console.error(e); }
  }, [token, isPatient]);

  const fetchSlots = useCallback(async (doctorId, date, setter) => {
    if (!doctorId || !date) { setter([]); return; }
    setter && setLoadingSlots(true);
    try {
      const res = await fetch(`${API}/doctors/${doctorId}/slots?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setter(d.slots || []);
      } else {
        setter(timeSlots); // fallback
      }
    } catch { setter(timeSlots); }
    finally { setLoadingSlots(false); }
  }, [token]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (!isPatient && filterDoctor) params.append('doctorId', filterDoctor);
      if (filterStatus)               params.append('status',   filterStatus);
      if (filterDateFrom)             params.append('startDate', filterDateFrom);
      if (filterDateTo)               params.append('endDate',   filterDateTo);

      const url = `${API}/appointments${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setAppointments(d.appointments || []);
      } else {
        const d = await res.json();
        setError(d.error || 'Erreur lors du chargement');
      }
    } catch { setError('Erreur réseau. Veuillez réessayer.'); }
    finally { setLoading(false); }
  }, [token, isPatient, filterDoctor, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchDoctors(); fetchPatients(); }, []);
  useEffect(() => { fetchAppointments(); }, [filterDoctor, filterStatus, filterDateFrom, filterDateTo, token]);

  // Auto-fetch slots when doctor+date selected in booking modal
  useEffect(() => {
    if (showModal && bookingDoctor && bookingDate) {
      fetchSlots(bookingDoctor, bookingDate, setAvailableSlots);
    }
  }, [bookingDoctor, bookingDate, showModal]);

  useEffect(() => {
    if (showRescheduleModal && rescheduleAppt && rescheduleDate) {
      fetchSlots(rescheduleAppt.doctorId, rescheduleDate, setRescheduleSlots);
    }
  }, [rescheduleDate, showRescheduleModal]);

  // ── Client-side filtering (hour + search) ─────────────────────────────────
  const filteredAppointments = appointments.filter(appt => {
    const apptHour = new Date(appt.startTime).getHours();
    const apptMin  = new Date(appt.startTime).getMinutes();
    const apptTime = apptHour * 60 + apptMin;

    if (filterHourFrom) {
      const [h, m] = filterHourFrom.split(':').map(Number);
      if (apptTime < h * 60 + m) return false;
    }
    if (filterHourTo) {
      const [h, m] = filterHourTo.split(':').map(Number);
      if (apptTime > h * 60 + m) return false;
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const patientName = `${appt.patient?.firstName || ''} ${appt.patient?.lastName || ''}`.toLowerCase();
      const doctorName  = (appt.doctor?.name || '').toLowerCase();
      const notes       = (appt.notes || '').toLowerCase();
      if (!patientName.includes(q) && !doctorName.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleBook = async (e) => {
    e.preventDefault();
    setBookingError(''); setBookingSuccess('');
    try {
      const body = {
        doctorId:  parseInt(bookingDoctor),
        patientId: isPatient ? currentUser.id : parseInt(bookingPatient),
        startTime: new Date(`${bookingDate}T${bookingTime}:00`).toISOString(),
        duration: 30,
        notes: bookingNotes,
      };
      const res = await fetch(`${API}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la réservation');
      setBookingSuccess('Rendez-vous réservé avec succès !');
      fetchAppointments();
      setTimeout(() => { setShowModal(false); setBookingSuccess(''); }, 1600);
    } catch (err) { setBookingError(err.message); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) return;
    try {
      let res = await fetch(`${API}/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        res = await fetch(`${API}/appointments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'CANCELLED' }),
        });
      }
      if (res.ok) fetchAppointments();
      else { const d = await res.json(); setError(d.error || "Erreur d'annulation"); }
    } catch { setError('Erreur réseau.'); }
  };

  const handleConfirm = async (id) => {
    try {
      const res = await fetch(`${API}/appointments/${id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchAppointments();
    } catch (e) { console.error(e); }
  };

  const openReschedule = (appt) => {
    setRescheduleAppt(appt);
    const d = new Date(appt.startTime);
    const dateStr = d.toISOString().split('T')[0];
    setRescheduleDate(dateStr);
    setRescheduleTime(d.toTimeString().slice(0, 5));
    setRescheduleError(''); setRescheduleSuccess('');
    setShowRescheduleModal(true);
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    setRescheduleError(''); setRescheduleSuccess('');
    try {
      const res = await fetch(`${API}/appointments/${rescheduleAppt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          startTime: new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString(),
          duration: 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de déplacement');
      setRescheduleSuccess('Rendez-vous déplacé !');
      fetchAppointments();
      setTimeout(() => { setShowRescheduleModal(false); setRescheduleSuccess(''); }, 1600);
    } catch (err) { setRescheduleError(err.message); }
  };

  const resetFilters = () => {
    setFilterDoctor(isDoctor ? String(currentUser.id) : '');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterHourFrom('');
    setFilterHourTo('');
    setFilterSearch('');
  };

  // ── Badge helper ──────────────────────────────────────────────────────────
  const badge = (status) => {
    const map = {
      CONFIRMED: { cls: 'badge-success', label: 'Confirmé',   icon: <CheckCircle size={11} /> },
      PENDING:   { cls: 'badge-warning', label: 'En attente', icon: <Clock size={11} /> },
      CANCELLED: { cls: 'badge-danger',  label: 'Annulé',     icon: <X size={11} /> },
      MOVED:     { cls: 'badge-primary', label: 'Déplacé',    icon: <Edit3 size={11} /> },
    };
    return map[status] || { cls: 'badge-warning', label: status, icon: null };
  };

  // ── Shared filter panel ───────────────────────────────────────────────────
  const FilterPanel = () => (
    <div className="glass-card animate-slide-in" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

        {/* Search */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Recherche libre</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-control"
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
              placeholder="Patient, médecin, note…"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Doctor filter (hidden for doctor — they see only their own) */}
        {!isDoctor && !isPatient && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Médecin</label>
            <select className="form-control" style={{ fontSize: '0.85rem' }}
              value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}>
              <option value="">Tous les médecins</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Statut</label>
          <select className="form-control" style={{ fontSize: '0.85rem' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tous</option>
            <option value="PENDING">En attente</option>
            <option value="CONFIRMED">Confirmés</option>
            <option value="CANCELLED">Annulés</option>
            <option value="MOVED">Déplacés</option>
          </select>
        </div>

        {/* Date range */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Date du</label>
          <input type="date" className="form-control" style={{ fontSize: '0.85rem' }}
            value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Date au</label>
          <input type="date" className="form-control" style={{ fontSize: '0.85rem' }}
            value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        </div>

        {/* Hour range */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Heure de</label>
          <select className="form-control" style={{ fontSize: '0.85rem' }}
            value={filterHourFrom} onChange={e => setFilterHourFrom(e.target.value)}>
            <option value="">—</option>
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Heure à</label>
          <select className="form-control" style={{ fontSize: '0.85rem' }}
            value={filterHourTo} onChange={e => setFilterHourTo(e.target.value)}>
            <option value="">—</option>
            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', gap: '10px' }}>
        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '7px 16px' }} onClick={resetFilters}>
          <X size={14} /> Réinitialiser
        </button>
        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '7px 16px' }} onClick={fetchAppointments}>
          <Search size={14} /> Appliquer
        </button>
      </div>
    </div>
  );

  // ── Appointment card ──────────────────────────────────────────────────────
  const ApptCard = ({ appt }) => {
    const dateObj   = new Date(appt.startTime);
    const endObj    = new Date(appt.endTime);
    const isCancelled = appt.status === 'CANCELLED';
    const isPast      = dateObj < new Date();
    const { cls, label, icon: statusIcon } = badge(appt.status);

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: isCancelled ? 'rgba(239,68,68,0.04)' : 'rgba(30,41,59,0.25)',
        border: `1px solid ${isCancelled ? 'rgba(239,68,68,0.18)' : 'var(--border-color)'}`,
        borderRadius: '14px',
        padding: '14px 20px',
        opacity: isCancelled ? 0.55 : 1,
        transition: 'box-shadow 0.2s',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Date block */}
        <div style={{ textAlign: 'center', paddingRight: '20px', borderRight: '1px solid var(--border-color)', minWidth: '62px' }}>
          <span style={{ display: 'block', fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.1 }}>
            {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {dateObj.toLocaleDateString('fr-FR', { weekday: 'short' })}
          </span>
        </div>

        {/* Info block */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Clock size={13} color="var(--text-muted)" />
            <strong style={{ fontSize: '0.88rem' }}>
              {dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {endObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
          {isPatient ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Stethoscope size={13} color="var(--primary)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{appt.doctor?.name || 'Médecin'}</span>
              {appt.doctor?.specialty && (
                <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.12)', padding: '2px 8px', borderRadius: '6px', color: 'var(--secondary)' }}>
                  {appt.doctor.specialty}
                </span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <User size={13} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                {appt.patient?.firstName} {appt.patient?.lastName}
              </span>
              {appt.patient?.phone && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Phone size={10} /> {appt.patient.phone}
                </span>
              )}
            </div>
          )}
          {appt.notes && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '5px', alignItems: 'center' }}>
              <FileText size={11} /> {appt.notes}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`badge ${cls}`} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {statusIcon} {label}
          </span>
          {!isPatient && appt.status === 'PENDING' && (
            <button
              className="btn btn-outline"
              style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)' }}
              onClick={() => handleConfirm(appt.id)}
            >
              <CheckCircle size={13} /> Valider
            </button>
          )}
          {!isCancelled && !isPast && (
            <>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                onClick={() => openReschedule(appt)}
                title="Déplacer"
              >
                <Edit3 size={13} /> Modifier
              </button>
              <button
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.25)' }}
                onClick={() => handleCancel(appt.id)}
                title="Annuler"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
          {isPast && !isCancelled && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Terminé</span>
          )}
        </div>
      </div>
    );
  };

  // ── Slot picker shared component ──────────────────────────────────────────
  const SlotPicker = ({ doctorId, date, selected, onSelect, loading: ld, slots }) => {
    const toDisplay = slots.length > 0 ? slots : timeSlots;
    return (
      <div>
        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', display: 'block' }}>
          Créneau horaire {ld && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chargement…</span>}
          {!ld && slots.length > 0 && (
            <span style={{ color: 'var(--success)', marginLeft: '8px', fontSize: '0.72rem' }}>
              ✓ {slots.length} créneaux libres
            </span>
          )}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {toDisplay.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => onSelect(t)}
              className="btn btn-outline"
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                background: selected === t ? 'rgba(14,165,233,0.18)' : 'transparent',
                borderColor: selected === t ? 'var(--primary)' : 'var(--border-color)',
                color: selected === t ? 'var(--primary)' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ── Booking modal ─────────────────────────────────────────────────────────
  const BookingModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', margin: 0 }}>
            {isPatient ? '📅 Prendre un rendez-vous' : '📅 Réserver un rendez-vous'}
          </h3>
          <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => { setShowModal(false); setBookingError(''); setBookingSuccess(''); }}>
            <X size={16} />
          </button>
        </div>

        {bookingError && <Alert type="error" msg={bookingError} />}
        {bookingSuccess && <Alert type="success" msg={bookingSuccess} />}

        <form onSubmit={handleBook}>
          {!isPatient && (
            <div className="form-group">
              <label className="form-label">Patient</label>
              <select className="form-control" value={bookingPatient} onChange={e => setBookingPatient(e.target.value)} required>
                {patientsList.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Médecin</label>
            <select className="form-control" value={bookingDoctor} onChange={e => setBookingDoctor(e.target.value)} required>
              <option value="">— Choisir —</option>
              {doctors.length > 0
                ? doctors.map(d => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)
                : <>
                    <option value="1">Dr. Jean Dupont — Généraliste</option>
                    <option value="2">Dr. Sophie Lefèvre — Pédiatrie</option>
                  </>
              }
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={bookingDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setBookingDate(e.target.value)} required />
          </div>

          {bookingDoctor && bookingDate && (
            <div className="form-group">
              <SlotPicker
                doctorId={bookingDoctor}
                date={bookingDate}
                selected={bookingTime}
                onSelect={setBookingTime}
                loading={loadingSlots}
                slots={availableSlots}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Motif de consultation</label>
            <input type="text" className="form-control" value={bookingNotes}
              onChange={e => setBookingNotes(e.target.value)}
              placeholder="Ex: Consultation générale, suivi, grippe…" />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmer le rendez-vous</button>
            <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setBookingError(''); }}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Reschedule modal ──────────────────────────────────────────────────────
  const RescheduleModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} color="var(--primary)" /> Modifier le rendez-vous
          </h3>
          <button className="btn btn-outline" style={{ padding: '6px' }} onClick={() => setShowRescheduleModal(false)}><X size={16} /></button>
        </div>

        {rescheduleError   && <Alert type="error"   msg={rescheduleError} />}
        {rescheduleSuccess && <Alert type="success" msg={rescheduleSuccess} />}

        {rescheduleAppt && (
          <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.18)', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '0.85rem' }}>
            <strong>RDV actuel :</strong> {new Date(rescheduleAppt.startTime).toLocaleString('fr-FR')}
            <br />
            <span style={{ color: 'var(--text-secondary)' }}>
              {isPatient ? `Dr. ${rescheduleAppt.doctor?.name || ''}` : `${rescheduleAppt.patient?.firstName || ''} ${rescheduleAppt.patient?.lastName || ''}`}
            </span>
          </div>
        )}

        <form onSubmit={handleReschedule}>
          <div className="form-group">
            <label className="form-label">Nouvelle date</label>
            <input type="date" className="form-control" value={rescheduleDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setRescheduleDate(e.target.value)} required />
          </div>

          {rescheduleDate && (
            <div className="form-group">
              <SlotPicker
                doctorId={rescheduleAppt?.doctorId}
                date={rescheduleDate}
                selected={rescheduleTime}
                onSelect={setRescheduleTime}
                loading={loadingSlots}
                slots={rescheduleSlots}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Déplacer le RDV</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowRescheduleModal(false)}>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Alert helper ──────────────────────────────────────────────────────────
  const Alert = ({ type, msg }) => (
    <div style={{
      background: type === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)',
      border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
      color: type === 'error' ? 'var(--danger)' : 'var(--success)',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '0.85rem',
      marginBottom: '14px',
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    }}>
      {type === 'error' ? <ShieldAlert size={15} /> : <CheckCircle size={15} />}
      {msg}
    </div>
  );

  // ── Patient summary stats ─────────────────────────────────────────────────
  const upcomingCount  = appointments.filter(a => a.status !== 'CANCELLED' && new Date(a.startTime) >= new Date()).length;
  const cancelledCount = appointments.filter(a => a.status === 'CANCELLED').length;
  const pendingCount   = appointments.filter(a => a.status === 'PENDING').length;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-slide-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            {isPatient ? 'Mes Rendez-vous' : 'Agenda Médical'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {isPatient
              ? 'Consultez, modifiez ou annulez vos consultations médicales'
              : 'Gestion complète des rendez-vous et des disponibilités médecins'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowFilters(v => !v)}
            style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.85rem' }}
          >
            <Filter size={15} />
            Filtres
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button className="btn btn-outline" onClick={fetchAppointments} disabled={loading} title="Actualiser">
            <RefreshCw size={16} className={loading ? 'pulse-active' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => { setShowModal(true); setBookingError(''); setBookingSuccess(''); }}>
            <Plus size={17} /> Prendre un RDV
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} /> {error}
          <button className="btn btn-outline" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '0.78rem', color: 'var(--danger)' }} onClick={() => setError('')}><X size={12} /></button>
        </div>
      )}

      {/* ── Patient summary cards ───────────────────────────────────────────── */}
      {isPatient && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          {[
            { icon: <Calendar size={20} />, label: 'Total RDV', value: appointments.length, color: 'var(--primary)', bg: 'rgba(14,165,233,0.15)' },
            { icon: <CheckCircle size={20} />, label: 'À venir', value: upcomingCount, color: 'var(--success)', bg: 'rgba(16,185,129,0.15)' },
            { icon: <Clock size={20} />, label: 'En attente', value: pendingCount, color: 'var(--warning)', bg: 'rgba(245,158,11,0.15)' },
            { icon: <X size={20} />, label: 'Annulés', value: cancelledCount, color: 'var(--danger)', bg: 'rgba(239,68,68,0.15)' },
          ].map(stat => (
            <div key={stat.label} className="glass-card glass-card-hover" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '16px' }}>
              <div style={{ padding: '10px', background: stat.bg, borderRadius: '10px', color: stat.color }}>{stat.icon}</div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{stat.label}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Doctor quick selector (staff view) */}
      {!isPatient && doctors.length > 0 && (
        <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Stethoscope size={16} color="var(--primary)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Médecin :</span>
          <button
            className="btn btn-outline"
            style={{ padding: '5px 14px', fontSize: '0.8rem', background: !filterDoctor ? 'rgba(14,165,233,0.12)' : 'transparent', borderColor: !filterDoctor ? 'var(--primary)' : 'var(--border-color)', color: !filterDoctor ? 'var(--primary)' : 'var(--text-secondary)' }}
            onClick={() => setFilterDoctor('')}
          >
            Tous
          </button>
          {doctors.map(d => (
            <button
              key={d.id}
              className="btn btn-outline"
              style={{
                padding: '5px 14px', fontSize: '0.8rem',
                background: filterDoctor === String(d.id) ? 'rgba(14,165,233,0.12)' : 'transparent',
                borderColor: filterDoctor === String(d.id) ? 'var(--primary)' : 'var(--border-color)',
                color: filterDoctor === String(d.id) ? 'var(--primary)' : 'var(--text-secondary)',
              }}
              onClick={() => setFilterDoctor(String(d.id))}
            >
              <User size={13} style={{ marginRight: '5px' }} />{d.name}
              {d.specialty && <span style={{ marginLeft: '5px', opacity: 0.6, fontSize: '0.72rem' }}>({d.specialty})</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Advanced filter panel ───────────────────────────────────────────── */}
      {showFilters && <FilterPanel />}

      {/* ── Appointments list ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Calendar size={20} color="var(--primary)" />
            {isPatient ? 'Mes rendez-vous' : 'Rendez-vous planifiés'}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(14,165,233,0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(14,165,233,0.15)' }}>
            {filteredAppointments.length} résultat{filteredAppointments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} className="pulse-active" style={{ marginBottom: '12px' }} />
            <p>Chargement des rendez-vous…</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '14px' }}>
            <Calendar size={42} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ fontSize: '1rem', fontWeight: 600 }}>Aucun rendez-vous trouvé</p>
            <p style={{ fontSize: '0.84rem', marginTop: '6px' }}>
              {(filterDoctor || filterStatus || filterDateFrom || filterDateTo || filterHourFrom || filterHourTo || filterSearch)
                ? 'Essayez de modifier ou réinitialiser vos filtres.'
                : 'Cliquez sur « Prendre un RDV » pour commencer.'
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredAppointments.map(appt => <ApptCard key={appt.id} appt={appt} />)}
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showModal           && <BookingModal />}
      {showRescheduleModal && <RescheduleModal />}
    </div>
  );
}