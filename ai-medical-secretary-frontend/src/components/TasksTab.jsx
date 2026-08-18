import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList, Plus, X, Check, Trash2, Edit2, Clock, AlertTriangle,
  Calendar, Loader2, Filter
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config API — même convention que les autres dashboards
// ---------------------------------------------------------------------------
const buildApiUrl = (path) => `http://localhost:3001${path}`;

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const apiRequest = async (path, token, options = {}) => {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) },
  });
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || `Erreur API (${response.status})`);
  }
  return data;
};

// ---------------------------------------------------------------------------
// Constantes métier
// ---------------------------------------------------------------------------
const PRIORITIES = {
  URGENTE: { label: 'Urgente', color: '#f87171', bg: 'rgba(239, 68, 68, 0.12)' },
  NORMALE: { label: 'Normale', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)' },
  BASSE: { label: 'Basse', color: '#34d399', bg: 'rgba(16, 185, 129, 0.12)' },
};

const STATUSES = {
  A_FAIRE: { label: 'À faire', color: '#94a3b8' },
  EN_COURS: { label: 'En cours', color: '#0ea5e9' },
  TERMINEE: { label: 'Terminée', color: '#34d399' },
};

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'NORMALE',
  dueDate: '',
};

/**
 * TasksTab — Liste de tâches INDÉPENDANTE par rôle.
 * Chaque dashboard (Secrétaire, Médecin, Admin) passe son propre `role` fixe :
 * les tâches créées ici sont scopées à ce rôle et ne sont jamais visibles
 * ni mélangées avec celles des autres rôles.
 *
 * Props :
 *  - token : JWT de l'utilisateur connecté
 *  - role  : 'SECRETARY' | 'DOCTOR' | 'ADMIN' (rôle propriétaire de cette liste)
 *  - currentUser : { id, ... } (optionnel, pour createdBy)
 */
export default function TasksTab({ token, role, currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // ---- Chargement des tâches, filtrées côté serveur par rôle -------------
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/v1/tasks?role=${role}`, token);
      setTasks(Array.isArray(data) ? data : data?.tasks || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les tâches.');
    } finally {
      setLoading(false);
    }
  }, [role, token]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ---- Filtrage local (statut uniquement — le rôle est déjà fixé) --------
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => t.assignedRole === role) // garde-fou côté client
      .filter((t) => statusFilter === 'ALL' || t.status === statusFilter)
      .sort((a, b) => {
        if (a.status === 'TERMINEE' && b.status !== 'TERMINEE') return 1;
        if (a.status !== 'TERMINEE' && b.status === 'TERMINEE') return -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      });
  }, [tasks, statusFilter, role]);

  const counts = useMemo(() => ({
    ALL: tasks.length,
    A_FAIRE: tasks.filter((t) => t.status === 'A_FAIRE').length,
    EN_COURS: tasks.filter((t) => t.status === 'EN_COURS').length,
    TERMINEE: tasks.filter((t) => t.status === 'TERMINEE').length,
  }), [tasks]);

  // ---- Formulaire ----------------------------------------------------------
  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (task) => {
    setForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'NORMALE',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
    setEditingId(task.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        const updated = await apiRequest(`/api/v1/tasks/${editingId}`, token, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updated } : t)));
      } else {
        const created = await apiRequest('/api/v1/tasks', token, {
          method: 'POST',
          body: JSON.stringify({ ...form, assignedRole: role, createdBy: currentUser?.id }),
        });
        setTasks((prev) => [created, ...prev]);
      }
      closeForm();
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer la tâche.");
    } finally {
      setSubmitting(false);
    }
  };

  const cycleStatus = async (task) => {
    const order = ['A_FAIRE', 'EN_COURS', 'TERMINEE'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    const prevTasks = tasks;
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await apiRequest(`/api/v1/tasks/${task.id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
    } catch (err) {
      setTasks(prevTasks);
      setError(err.message || 'Impossible de mettre à jour le statut.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement cette tâche ?')) return;
    const prevTasks = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      await apiRequest(`/api/v1/tasks/${id}`, token, { method: 'DELETE' });
    } catch (err) {
      setTasks(prevTasks);
      setError(err.message || 'Impossible de supprimer la tâche.');
    }
  };

  const isOverdue = (task) =>
    task.dueDate && task.status !== 'TERMINEE' && new Date(task.dueDate) < new Date(new Date().toDateString());

  // ---------------------------------------------------------------------
  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
          Tâches propres à votre rôle — invisibles pour les autres espaces.
        </p>
        <button type="button" className="btn btn-primary" onClick={openCreateForm} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', fontSize: '0.85rem',
        }}>
          <Plus size={16} /> Nouvelle tâche
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#f87171', padding: '10px 14px', borderRadius: '10px', fontSize: '0.82rem',
          marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertTriangle size={15} />
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filtres de statut */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px', alignItems: 'center' }}>
        <Filter size={14} color="var(--text-muted)" />
        {['ALL', 'A_FAIRE', 'EN_COURS', 'TERMINEE'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            style={{
              padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
              border: statusFilter === key ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: statusFilter === key ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
              color: statusFilter === key ? '#0ea5e9' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {key === 'ALL' ? 'Toutes' : STATUSES[key].label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card animate-slide-in" style={{
          padding: '20px', marginBottom: '20px', border: '1px solid rgba(14, 165, 233, 0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
              {editingId ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </h3>
            <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Titre</label>
            <input
              type="text"
              className="form-control"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex : Rappeler le patient Dupont"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (optionnel)</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Détails de la tâche..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Priorité</label>
              <select
                className="form-control"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {Object.entries(PRIORITIES).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Échéance</label>
              <input
                type="date"
                className="form-control"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{
            width: '100%', padding: '11px', fontWeight: 600, fontSize: '0.88rem', marginTop: '6px',
          }}>
            {submitting ? 'Enregistrement...' : (editingId ? 'Enregistrer les modifications' : 'Créer la tâche')}
          </button>
        </form>
      )}

      {/* Liste des tâches */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Loader2 size={20} style={{ marginRight: '8px' }} />
          Chargement des tâches...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)',
          border: '1px dashed var(--border-color)', borderRadius: '12px',
        }}>
          <ClipboardList size={28} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Aucune tâche ne correspond à ce filtre.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTasks.map((task) => {
            const priorityInfo = PRIORITIES[task.priority] || PRIORITIES.NORMALE;
            const statusInfo = STATUSES[task.status] || STATUSES.A_FAIRE;
            const overdue = isOverdue(task);

            return (
              <div key={task.id} style={{
                padding: '14px 16px',
                background: 'rgba(30, 41, 59, 0.25)',
                border: '1px solid var(--border-color)',
                borderLeft: `3px solid ${priorityInfo.color}`,
                borderRadius: '10px',
                opacity: task.status === 'TERMINEE' ? 0.6 : 1,
                display: 'flex', alignItems: 'flex-start', gap: '12px',
              }}>
                <button
                  type="button"
                  onClick={() => cycleStatus(task)}
                  title={`Statut : ${statusInfo.label} (cliquer pour changer)`}
                  style={{
                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, marginTop: '2px',
                    border: `2px solid ${statusInfo.color}`,
                    background: task.status === 'TERMINEE' ? statusInfo.color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  {task.status === 'TERMINEE' && <Check size={14} color="white" />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontWeight: 600, fontSize: '0.9rem',
                      textDecoration: task.status === 'TERMINEE' ? 'line-through' : 'none',
                    }}>
                      {task.title}
                    </span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      background: priorityInfo.bg, color: priorityInfo.color,
                    }}>
                      {priorityInfo.label}
                    </span>
                  </div>

                  {task.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {task.dueDate && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem',
                        color: overdue ? '#f87171' : 'var(--text-muted)',
                      }}>
                        <Calendar size={12} />
                        {new Date(task.dueDate).toLocaleDateString('fr-FR')}
                        {overdue && ' (en retard)'}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: statusInfo.color }}>
                      <Clock size={12} /> {statusInfo.label}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button type="button" onClick={() => openEditForm(task)} title="Modifier" style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                  }}>
                    <Edit2 size={15} />
                  </button>
                  <button type="button" onClick={() => handleDelete(task.id)} title="Supprimer" style={{
                    background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px',
                  }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}