import React, { useState, useEffect } from 'react';
import {
  Users, UserPlus, Trash2, Edit3, Shield, Stethoscope, UserCheck,
  BarChart3, Settings2, Save, AlertTriangle, X, Search, Building2,
  Clock, Bell, TrendingUp, PhoneCall, Calendar as CalendarIcon
} from 'lucide-react';

const ROLES = [
  { val: 'DOCTOR', label: 'Médecin', icon: <Stethoscope size={14} /> },
  { val: 'SECRETARY', label: 'Secrétaire', icon: <UserCheck size={14} /> },
  { val: 'ADMIN', label: 'Administrateur', icon: <Shield size={14} /> },
  { val: 'PATIENT', label: 'Patient', icon: <Users size={14} /> },
];

const EMPTY_USER_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'SECRETARY',
  specialty: '',
  phone: '',
};

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function AdminDashboard({ token }) {
  const [activeTab, setActiveTab] = useState('users');
  const [error, setError] = useState('');

  // ─── Gestion des utilisateurs ───
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [userFormError, setUserFormError] = useState('');

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.append('role', roleFilter);
      if (userSearch) params.append('search', userSearch);
      const res = await fetch(`http://localhost:3001/api/v1/users?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des utilisateurs');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingUsers(false);
    }
  };

  const openCreateUserForm = () => {
    setEditingUserId(null);
    setUserForm(EMPTY_USER_FORM);
    setUserFormError('');
    setShowUserForm(true);
  };

  const openEditUserForm = (u) => {
    setEditingUserId(u.id);
    setUserForm({
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      role: u.role || 'SECRETARY',
      specialty: u.specialty || '',
      phone: u.phone || '',
    });
    setUserFormError('');
    setShowUserForm(true);
  };

  const closeUserForm = () => {
    setShowUserForm(false);
    setEditingUserId(null);
    setUserForm(EMPTY_USER_FORM);
    setUserFormError('');
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setUserFormError('');

    if (!userForm.firstName.trim() || !userForm.lastName.trim()) {
      setUserFormError('Prénom et nom requis.');
      return;
    }
    if (!userForm.email.trim()) {
      setUserFormError('Email requis.');
      return;
    }

    try {
      const isEditing = Boolean(editingUserId);
      const url = isEditing
        ? `http://localhost:3001/api/v1/users/${editingUserId}`
        : 'http://localhost:3001/api/v1/users';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userForm)
      });

      const data = await res.json();

      if (res.ok) {
        closeUserForm();
        fetchUsers();
      } else {
        setUserFormError(data.error || `Erreur lors de ${isEditing ? 'la modification' : 'la création'} de l'utilisateur`);
      }
    } catch (e) {
      console.error(e);
      setUserFormError('Erreur réseau');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Supprimer définitivement cet utilisateur ?')) return;
    try {
      const res = await fetch(`http://localhost:3001/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || "Impossible de supprimer cet utilisateur");
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de la suppression');
    }
  };

  // ─── Rapports ───
  const [reportStats, setReportStats] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('month'); // 'week' | 'month' | 'year'

  const fetchReportStats = async () => {
    setLoadingReports(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/v1/reports/stats?period=${reportPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReportStats(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement des rapports');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingReports(false);
    }
  };

  // ─── Configuration générale ───
  const [config, setConfig] = useState({
    clinicName: '',
    address: '',
    phone: '',
    email: '',
    hours: DAYS_FR.map(day => ({ day, open: '09:00', close: '18:00', closed: day === 'Dimanche' })),
    notifyEmergencyEmail: true,
    notifyEmergencySms: true,
    aiEmergencyAutoEscalate: true,
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');

  const fetchConfig = async () => {
    setLoadingConfig(true);
    setError('');
    try {
      const res = await fetch('http://localhost:3001/api/v1/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setConfig(prev => ({ ...prev, ...data.settings }));
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du chargement de la configuration');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau');
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveConfig = async (e) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccess('');
    setError('');
    try {
      const res = await fetch('http://localhost:3001/api/v1/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setConfigSuccess('Configuration enregistrée avec succès.');
        setTimeout(() => setConfigSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de l\'enregistrement');
      }
    } catch (e) {
      console.error(e);
      setError('Erreur réseau lors de l\'enregistrement');
    } finally {
      setConfigSaving(false);
    }
  };

  const updateHour = (index, field, value) => {
    setConfig(prev => {
      const hours = [...prev.hours];
      hours[index] = { ...hours[index], [field]: value };
      return { ...prev, hours };
    });
  };

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'reports') fetchReportStats();
    if (activeTab === 'config') fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, roleFilter, reportPeriod]);

  const roleBadge = (role) => {
    const map = {
      DOCTOR: { cls: 'badge-primary', label: 'Médecin' },
      SECRETARY: { cls: 'badge-warning', label: 'Secrétaire' },
      ADMIN: { cls: 'badge-danger', label: 'Administrateur' },
      PATIENT: { cls: 'badge-success', label: 'Patient' },
    };
    return map[role] || { cls: 'badge-warning', label: role };
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-slide-in">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Espace Administrateur</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Gestion des utilisateurs, rapports et configuration générale du cabinet
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: 'Gestion des utilisateurs', icon: <Users size={16} /> },
          { id: 'reports', label: 'Rapports', icon: <BarChart3 size={16} /> },
          { id: 'config', label: 'Configuration générale', icon: <Settings2 size={16} /> },
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

      {/* ─── GESTION DES UTILISATEURS ─── */}
      {activeTab === 'users' && (
        <div>
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '38px' }}
                placeholder="Rechercher un utilisateur (nom, email)..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <select
              className="form-control"
              style={{ minWidth: '170px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Tous les rôles</option>
              {ROLES.map(r => (
                <option key={r.val} value={r.val}>{r.label}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={openCreateUserForm}>
              <UserPlus size={16} /> Nouvel utilisateur
            </button>
          </div>

          <div className="glass-card" style={{ padding: '20px' }}>
            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                Aucun utilisateur trouvé.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredUsers.map((u) => {
                  const badge = roleBadge(u.role);
                  return (
                    <div
                      key={u.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: 'rgba(30, 41, 59, 0.25)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div style={{ height: '38px', width: '38px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                          <Users size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9rem', display: 'block' }}>{u.firstName} {u.lastName}</strong>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '7px 10px', color: 'var(--primary)', borderColor: 'rgba(14, 165, 233, 0.3)' }}
                          onClick={() => openEditUserForm(u)}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '7px 10px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => deleteUser(u.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── RAPPORTS ─── */}
      {activeTab === 'reports' && (
        <div>
          <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '18px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Période :</span>
            {[
              { val: 'week', label: 'Semaine' },
              { val: 'month', label: 'Mois' },
              { val: 'year', label: 'Année' },
            ].map(p => (
              <button
                key={p.val}
                className="btn btn-outline"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  background: reportPeriod === p.val ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                  borderColor: reportPeriod === p.val ? 'var(--primary)' : 'var(--border-color)',
                  color: reportPeriod === p.val ? 'var(--primary)' : 'var(--text-secondary)'
                }}
                onClick={() => setReportPeriod(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {loadingReports ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Chargement des rapports...
            </div>
          ) : !reportStats ? (
            <div className="glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              Aucune donnée disponible pour cette période.
            </div>
          ) : (
            <>
              {/* Stats cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
                  <div style={{ padding: '10px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '12px', color: 'var(--primary)' }}>
                    <CalendarIcon size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Rendez-vous</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{reportStats.totalAppointments ?? 0}</span>
                  </div>
                </div>

                <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '12px', color: 'var(--success)' }}>
                    <TrendingUp size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Taux de confirmation</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{reportStats.confirmationRate ?? 0}%</span>
                  </div>
                </div>

                <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
                  <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '12px', color: 'var(--secondary)' }}>
                    <PhoneCall size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Appels IA traités</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{reportStats.totalCalls ?? 0}</span>
                  </div>
                </div>

                <div className="glass-card glass-card-hover" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '18px' }}>
                  <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: 'var(--danger)' }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Urgences détectées</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{reportStats.totalEmergencies ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Répartition par médecin (barres simples en CSS, sans dépendance externe) */}
              {Array.isArray(reportStats.byDoctor) && reportStats.byDoctor.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '18px' }}>Rendez-vous par médecin</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {reportStats.byDoctor.map((d, i) => {
                      const max = Math.max(...reportStats.byDoctor.map(x => x.count), 1);
                      const pct = Math.round((d.count / max) * 100);
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                            <span>{d.name}</span>
                            <strong>{d.count}</strong>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(to right, #0ea5e9, #6366f1)', borderRadius: '4px' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── CONFIGURATION GÉNÉRALE ─── */}
      {activeTab === 'config' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          {loadingConfig ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Chargement...</div>
          ) : (
            <form onSubmit={saveConfig}>
              {configSuccess && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: 'var(--success)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '18px'
                }}>
                  {configSuccess}
                </div>
              )}

              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} color="var(--primary)" /> Informations du cabinet
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label">Nom du cabinet</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.clinicName}
                    onChange={(e) => setConfig({ ...config, clinicName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={config.phone}
                    onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Adresse</label>
                  <input
                    type="text"
                    className="form-control"
                    value={config.address}
                    onChange={(e) => setConfig({ ...config, address: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Email de contact</label>
                  <input
                    type="email"
                    className="form-control"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                  />
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--primary)" /> Horaires d'ouverture
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {config.hours.map((h, i) => (
                  <div key={h.day} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{h.day}</span>
                    <input
                      type="time"
                      className="form-control"
                      disabled={h.closed}
                      value={h.open}
                      onChange={(e) => updateHour(i, 'open', e.target.value)}
                    />
                    <input
                      type="time"
                      className="form-control"
                      disabled={h.closed}
                      value={h.close}
                      onChange={(e) => updateHour(i, 'close', e.target.value)}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={h.closed}
                        onChange={(e) => updateHour(i, 'closed', e.target.checked)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      Fermé
                    </label>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--primary)" /> Notifications & IA
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={config.notifyEmergencyEmail}
                    onChange={(e) => setConfig({ ...config, notifyEmergencyEmail: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Notifier par email en cas d'urgence détectée par l'IA
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={config.notifyEmergencySms}
                    onChange={(e) => setConfig({ ...config, notifyEmergencySms: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Notifier par SMS en cas d'urgence détectée par l'IA
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
                  <input
                    type="checkbox"
                    checked={config.aiEmergencyAutoEscalate}
                    onChange={(e) => setConfig({ ...config, aiEmergencyAutoEscalate: e.target.checked })}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  Escalade automatique vers une secrétaire en cas d'urgence
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }} disabled={configSaving}>
                <Save size={16} /> {configSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Modal : Créer / Modifier un utilisateur */}
      {showUserForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-card animate-slide-in" style={{ width: '100%', maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem' }}>
                {editingUserId ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
              </h3>
              <button className="btn btn-outline" style={{ padding: '6px' }} onClick={closeUserForm}>
                <X size={16} />
              </button>
            </div>

            {userFormError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '14px'
              }}>
                {userFormError}
              </div>
            )}

            <form onSubmit={saveUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Prénom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select
                  className="form-control"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  {ROLES.map(r => (
                    <option key={r.val} value={r.val}>{r.label}</option>
                  ))}
                </select>
              </div>

              {userForm.role === 'DOCTOR' && (
                <div className="form-group">
                  <label className="form-label">Spécialité</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userForm.specialty}
                    onChange={(e) => setUserForm({ ...userForm, specialty: e.target.value })}
                    placeholder="Ex: Généraliste, Pédiatrie..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input
                  type="tel"
                  className="form-control"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {editingUserId ? 'Enregistrer' : 'Créer'}
                </button>
                <button type="button" className="btn btn-outline" onClick={closeUserForm}>Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}