import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard, Plus, RefreshCw, CheckCircle2, XCircle, Clock, RotateCcw,
  ExternalLink, Search, Wallet, Banknote, Landmark, Receipt, FileText,
  Download, TrendingUp, Euro, AlertCircle, ChevronRight, Shield, Zap
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

const METHODS = [
  { key: 'PAYPAL',   label: 'PayPal',         icon: Wallet,    color: '#003087', bg: 'rgba(0,48,135,0.15)',    border: 'rgba(0,48,135,0.4)' },
  { key: 'STRIPE',   label: 'Carte bancaire', icon: CreditCard, color: '#635bff', bg: 'rgba(99,91,255,0.15)',  border: 'rgba(99,91,255,0.4)' },
  { key: 'ESPECES',  label: 'Espèces',        icon: Banknote,  color: '#10b981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)' },
  { key: 'CHEQUE',   label: 'Chèque',         icon: Receipt,   color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
  { key: 'VIREMENT', label: 'Virement',       icon: Landmark,  color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.4)' },
];

const statusMeta = {
  PENDING:            { label: 'En attente',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   border: 'rgba(245,158,11,0.3)',   icon: Clock        },
  COMPLETED:          { label: 'Complété',      color: '#10b981', bg: 'rgba(16,185,129,0.12)',   border: 'rgba(16,185,129,0.3)',   icon: CheckCircle2 },
  FAILED:             { label: 'Échoué',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    border: 'rgba(239,68,68,0.3)',    icon: XCircle      },
  REFUNDED:           { label: 'Remboursé',     color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   border: 'rgba(99,102,241,0.3)',   icon: RotateCcw    },
  PARTIALLY_REFUNDED: { label: 'Remb. partiel', color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   border: 'rgba(99,102,241,0.3)',   icon: RotateCcw    },
};

const methodMap  = Object.fromEntries(METHODS.map(m => [m.key, m]));

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '15px',
      color: '#f8fafc',
      fontFamily: 'Inter, ui-sans-serif, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#475569' },
      iconColor: '#635bff',
    },
    invalid: { color: '#ef4444', iconColor: '#ef4444' },
  },
};

// ─── Styles inline réutilisables ─────────────────────────────────────────────
const S = {
  kpiCard: {
    background: 'rgba(18,24,43,0.7)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  row: {
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    transition: 'background 0.15s, border-color 0.15s',
  },
  sectionTitle: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#475569',
    marginBottom: '12px',
  },
  pill: (color, bg, border) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color,
    background: bg,
    border: `1px solid ${border}`,
  }),
  input: {
    width: '100%',
    padding: '11px 14px',
    background: 'rgba(11,15,29,0.8)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, sans-serif',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '6px',
    letterSpacing: '0.02em',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(14,165,233,0.3)',
    transition: 'all 0.2s',
    fontFamily: 'Inter, sans-serif',
  },
  btnOutline: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.8rem',
    background: 'rgba(255,255,255,0.03)',
    color: '#94a3b8',
    transition: 'all 0.15s',
    fontFamily: 'Inter, sans-serif',
  },
  formCard: {
    background: 'rgba(11,15,29,0.6)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '28px',
  },
};

// ─── Composant KPI ──────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ ...S.kpiCard }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.03em' }}>{label}</span>
        <div style={{ padding: '7px', borderRadius: '9px', background: `${color}18`, display: 'flex' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>{value}</span>
      {sub && <span style={{ fontSize: '0.72rem', color: '#475569' }}>{sub}</span>}
    </div>
  );
}

// ─── Composant FocusInput ────────────────────────────────────────────────────
function FInput({ label, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <input
        {...props}
        style={{
          ...S.input,
          borderColor: focused ? '#0ea5e9' : 'rgba(255,255,255,0.08)',
          boxShadow: focused ? '0 0 0 3px rgba(14,165,233,0.15)' : 'none',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function FSelect({ label, children, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <select
        {...props}
        style={{
          ...S.input,
          borderColor: focused ? '#0ea5e9' : 'rgba(255,255,255,0.08)',
          boxShadow: focused ? '0 0 0 3px rgba(14,165,233,0.15)' : 'none',
          appearance: 'none',
          cursor: 'pointer',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {children}
      </select>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────
export default function PaymentsTab({ token }) {
  const [activeSubTab, setActiveSubTab] = useState('list');

  // Liste
  const [payments, setPayments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('tous');
  const [methodFilter, setMethodFilter] = useState('tous');
  const [patientIdFilter, setPatientIdFilter] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [refundingId, setRefundingId] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Nouveau paiement
  const [selectedMethod, setSelectedMethod] = useState('PAYPAL');
  const [patientId, setPatientId] = useState('');
  const [appointmentId, setAppointmentId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [type, setType] = useState('PAYMENT');
  const [notes, setNotes] = useState('');

  const fetchPayments = async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'tous') params.append('status', statusFilter);
      if (methodFilter !== 'tous') params.append('method', methodFilter);
      if (patientIdFilter) params.append('patientId', patientIdFilter);
      const res = await fetch(`${API_BASE}/payments?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      }
    } catch (e) {
      console.error('Erreur Paiements:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'list') fetchPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, statusFilter, methodFilter]);

  const resetForm = () => {
    setPatientId(''); setAppointmentId('');
    setAmount(''); setType('PAYMENT'); setNotes('');
  };

  const handleRefund = async (paymentId) => {
    setRefundingId(paymentId);
    try {
      const res = await fetch(`${API_BASE}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(refundAmount ? { amount: Number(refundAmount) } : {}),
      });
      const data = await res.json();
      if (res.ok) fetchPayments();
      else alert(data.error || 'Erreur lors du remboursement');
    } catch (e) { console.error(e); }
    finally { setRefundingId(null); setRefundAmount(''); }
  };

  const handleGenerateInvoice = async (paymentId) => {
    setGeneratingInvoiceId(paymentId);
    try {
      const res = await fetch(`${API_BASE}/payments/${paymentId}/invoice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        fetchPayments();
        window.open(`${API_BASE}/payments/${paymentId}/invoice/download`, '_blank');
      } else alert(data.error || 'Erreur facture');
    } catch (e) { console.error(e); }
    finally { setGeneratingInvoiceId(null); }
  };

  // KPI calculés
  const totalCompleted = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + Number(p.amount), 0);
  const countPending   = payments.filter(p => p.status === 'PENDING').length;
  const countRefunded  = payments.filter(p => p.status?.includes('REFUND')).length;

  return (
    <div style={{ animation: 'slide-in 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0ea5e9', marginBottom: '6px' }}>
            Module 4.12
          </p>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em', color: '#f8fafc', margin: 0 }}>
            Paiements & Factures
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            Carte, PayPal, espèces — remboursements et factures PDF
          </p>
        </div>
        <button
          style={{ ...S.btnPrimary, padding: '10px 18px', fontSize: '0.82rem' }}
          onClick={() => { setActiveSubTab('new'); resetForm(); }}
        >
          <Plus size={15} /> Nouveau paiement
        </button>
      </div>

      {/* ── KPI ── */}
      {activeSubTab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
          <KpiCard icon={TrendingUp}   label="Encaissé (filtre actuel)"  value={`${totalCompleted.toFixed(2)} €`} sub={`${payments.filter(p=>p.status==='COMPLETED').length} transactions`} color="#10b981" />
          <KpiCard icon={Clock}        label="En attente"                value={countPending}  sub="paiements non confirmés"  color="#f59e0b" />
          <KpiCard icon={RotateCcw}    label="Remboursements"            value={countRefunded} sub="total ou partiel"          color="#6366f1" />
        </div>
      )}

      {/* ── Sous-onglets ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
        {[
          { key: 'list', label: 'Historique', icon: Receipt },
          { key: 'new',  label: 'Nouveau',    icon: Plus    },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveSubTab(key); if (key === 'new') resetForm(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '9px', border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem',
              fontFamily: 'Inter, sans-serif',
              background: activeSubTab === key ? 'rgba(14,165,233,0.15)' : 'transparent',
              color: activeSubTab === key ? '#0ea5e9' : '#64748b',
              transition: 'all 0.15s',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ══════════════════ HISTORIQUE ══════════════════ */}
      {activeSubTab === 'list' && (
        <div>
          {/* Filtres */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', marginBottom: '16px', alignItems: 'end' }}>
            <FSelect label="Statut" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="tous">Tous les statuts</option>
              {Object.entries(statusMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </FSelect>
            <FSelect label="Méthode" value={methodFilter} onChange={e => setMethodFilter(e.target.value)}>
              <option value="tous">Toutes les méthodes</option>
              {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </FSelect>
            <FInput label="ID Patient" type="number" placeholder="Ex : 12" value={patientIdFilter} onChange={e => setPatientIdFilter(e.target.value)} />
            <button style={{ ...S.btnOutline, height: '42px', padding: '0 14px' }} onClick={fetchPayments}>
              <RefreshCw size={13} /> Actualiser
            </button>
          </div>

          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loadingList ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569', fontSize: '0.85rem' }}>
                Chargement…
              </div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                <Receipt size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Aucune transaction</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Modifiez les filtres ou enregistrez un nouveau paiement.</p>
              </div>
            ) : (
              payments.map(p => {
                const meta   = statusMeta[p.status] || statusMeta.PENDING;
                const mth    = methodMap[p.method] || { label: p.method, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', icon: CreditCard };
                const MIcon  = mth.icon;
                const SIcon  = meta.icon;
                const isOpen = expandedId === p.id;
                const canRefund  = p.status === 'COMPLETED';
                const canInvoice = p.status === 'COMPLETED' || p.status?.includes('REFUND');

                return (
                  <div
                    key={p.id}
                    style={{
                      ...S.row,
                      borderColor: isOpen ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedId(isOpen ? null : p.id)}
                  >
                    {/* Ligne principale */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Icône méthode */}
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: mth.bg, border: `1px solid ${mth.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MIcon size={16} color={mth.color} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                              {Number(p.amount).toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>{p.currency}</span>
                            </span>
                            {p.type === 'DEPOSIT' && (
                              <span style={S.pill('#f59e0b', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)')}>Acompte</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                            Patient #{p.patientId}{p.appointmentId ? ` · RDV #${p.appointmentId}` : ''} · {new Date(p.createdAt).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={S.pill(meta.color, meta.bg, meta.border)}>
                          <SIcon size={11} /> {meta.label}
                        </span>
                        <ChevronRight size={14} color="#475569" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      </div>
                    </div>

                    {/* Détail expandé */}
                    {isOpen && (
                      <div
                        style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {p.externalId && (
                          <p style={{ fontSize: '0.72rem', color: '#475569', marginBottom: '12px', fontFamily: 'monospace' }}>
                            Réf. externe : {p.externalId}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {canRefund && (
                            <>
                              <input
                                type="number" step="0.01" placeholder="Montant partiel (vide = total)"
                                style={{ ...S.input, maxWidth: '200px', padding: '8px 12px', fontSize: '0.8rem' }}
                                value={refundingId === p.id ? refundAmount : ''}
                                onChange={e => { setRefundingId(p.id); setRefundAmount(e.target.value); }}
                              />
                              <button
                                style={{ ...S.btnOutline, color: '#6366f1', borderColor: 'rgba(99,102,241,0.35)' }}
                                onClick={() => handleRefund(p.id)}
                              >
                                <RotateCcw size={12} /> Rembourser
                              </button>
                            </>
                          )}
                          {canInvoice && (
                            <button
                              style={{ ...S.btnOutline, color: '#10b981', borderColor: 'rgba(16,185,129,0.35)' }}
                              onClick={() => handleGenerateInvoice(p.id)}
                              disabled={generatingInvoiceId === p.id}
                            >
                              {p.invoiceUrl ? <Download size={12} /> : <FileText size={12} />}
                              {generatingInvoiceId === p.id ? 'Génération…' : p.invoiceUrl ? 'Télécharger facture' : 'Générer facture'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ NOUVEAU PAIEMENT ══════════════════ */}
      {activeSubTab === 'new' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* Colonne gauche : sélecteur méthode + champs communs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Méthode */}
            <div style={S.formCard}>
              <p style={S.sectionTitle}>Méthode de paiement</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {METHODS.map(m => {
                  const MIcon = m.icon;
                  const active = selectedMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMethod(m.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '11px 14px', borderRadius: '10px',
                        border: `1px solid ${active ? m.border : 'rgba(255,255,255,0.06)'}`,
                        background: active ? m.bg : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: active ? m.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? m.border : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MIcon size={14} color={active ? m.color : '#64748b'} />
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: active ? '#f8fafc' : '#64748b' }}>{m.label}</span>
                      {active && <ChevronRight size={13} color={m.color} style={{ marginLeft: 'auto' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Champs communs */}
            <div style={S.formCard}>
              <p style={S.sectionTitle}>Informations</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <FInput label="ID Patient *" type="number" value={patientId} onChange={e => setPatientId(e.target.value)} required placeholder="Ex : 1" />
                <FInput label="ID Rendez-vous" type="number" value={appointmentId} onChange={e => setAppointmentId(e.target.value)} placeholder="Optionnel" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px' }}>
                  <FInput label="Montant *" type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
                  <FSelect label="Devise" value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </FSelect>
                </div>
                <FSelect label="Type" value={type} onChange={e => setType(e.target.value)}>
                  <option value="PAYMENT">Paiement complet</option>
                  <option value="DEPOSIT">Acompte</option>
                </FSelect>
                <div>
                  <label style={S.label}>Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optionnel…"
                    style={{ ...S.input, resize: 'vertical', minHeight: '60px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite : formulaire de la méthode sélectionnée */}
          <div style={S.formCard}>
            <p style={S.sectionTitle}>
              {METHODS.find(m => m.key === selectedMethod)?.label || 'Paiement'}
            </p>

            {selectedMethod === 'PAYPAL' && (
              <PayPalPaymentForm
                token={token}
                patientId={patientId} appointmentId={appointmentId}
                amount={amount} currency={currency} type={type} notes={notes}
                onDone={() => { resetForm(); setActiveSubTab('list'); fetchPayments(); }}
              />
            )}

            {selectedMethod === 'STRIPE' && (
              !stripePromise ? (
                <NoStripeKey />
              ) : (
                <Elements stripe={stripePromise}>
                  <StripePaymentForm
                    token={token}
                    patientId={patientId} appointmentId={appointmentId}
                    amount={amount} currency={currency} type={type} notes={notes}
                    onDone={() => { resetForm(); setActiveSubTab('list'); fetchPayments(); }}
                  />
                </Elements>
              )
            )}

            {['ESPECES', 'CHEQUE', 'VIREMENT'].includes(selectedMethod) && (
              <CabinetPaymentForm
                token={token} method={selectedMethod}
                patientId={patientId} appointmentId={appointmentId}
                amount={amount} currency={currency} type={type} notes={notes}
                onDone={() => { resetForm(); setActiveSubTab('list'); fetchPayments(); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message clé Stripe manquante ────────────────────────────────────────────
function NoStripeKey() {
  return (
    <div style={{ padding: '20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>
        <AlertCircle size={16} /> Stripe non configuré
      </div>
      <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.6' }}>
        Ajoutez votre clé publique dans le fichier <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>.env</code> du frontend, puis relancez Vite :
      </p>
      <pre style={{ margin: 0, padding: '10px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', fontSize: '0.78rem', color: '#f8fafc', fontFamily: 'monospace', overflowX: 'auto' }}>
{`VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`}
      </pre>
    </div>
  );
}

// ─── Alert helper ────────────────────────────────────────────────────────────
function Alert({ type, children }) {
  const styles = {
    success: { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  color: '#10b981' },
    error:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   color: '#ef4444' },
    info:    { bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.3)',  color: '#0ea5e9' },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{ padding: '12px 14px', background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: '10px', fontSize: '0.84rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {type === 'success' ? <CheckCircle2 size={14} /> : type === 'error' ? <XCircle size={14} /> : <Zap size={14} />}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PayPal
// ═══════════════════════════════════════════════════════════════════════════
function PayPalPaymentForm({ token, patientId, appointmentId, amount, currency, type, notes, onDone }) {
  const [creating, setCreating]   = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [captureResult, setCaptureResult] = useState(null);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!patientId || !amount) return;
    setCreating(true); setError(''); setOrderResult(null); setCaptureResult(null);
    try {
      const res = await fetch(`${API_BASE}/payments/paypal/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ patientId: Number(patientId), appointmentId: appointmentId ? Number(appointmentId) : undefined, amount: Number(amount), currency, type, notes: notes || undefined }),
      });
      const data = await res.json();
      if (res.ok) setOrderResult(data);
      else setError(data.error || "Erreur création ordre PayPal");
    } catch { setError('Erreur réseau'); }
    finally { setCreating(false); }
  };

  const handleCapture = async () => {
    if (!orderResult?.orderId) return;
    setCapturing(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/payments/paypal/capture/${orderResult.orderId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { setCaptureResult(data); if (data.captureStatus === 'COMPLETED') onDone(); }
      else setError(data.error || 'Erreur capture');
    } catch { setError('Erreur réseau'); }
    finally { setCapturing(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
        Un ordre PayPal sera créé. Vous serez redirigé vers la page d'approbation, puis vous pourrez capturer le paiement.
      </p>
      {error && <Alert type="error">{error}</Alert>}

      {!orderResult ? (
        <button style={{ ...S.btnPrimary, width: '100%', background: 'linear-gradient(135deg, #003087 0%, #009cde 100%)', boxShadow: '0 4px 14px rgba(0,48,135,0.35)' }} onClick={handleCreate} disabled={creating || !patientId || !amount}>
          <Wallet size={15} /> {creating ? 'Création…' : 'Créer l\'ordre PayPal'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Alert type="info">Ordre créé — approuvez le paiement sur PayPal avant de capturer.</Alert>
          <a href={orderResult.approveLink} target="_blank" rel="noopener noreferrer"
            style={{ ...S.btnOutline, textDecoration: 'none', justifyContent: 'center', padding: '10px', color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.3)' }}>
            <ExternalLink size={13} /> Ouvrir PayPal
          </a>
          <button style={{ ...S.btnPrimary, width: '100%' }} onClick={handleCapture} disabled={capturing}>
            <CheckCircle2 size={15} /> {capturing ? 'Capture…' : 'Capturer le paiement'}
          </button>
          {captureResult && (
            <Alert type={captureResult.captureStatus === 'COMPLETED' ? 'success' : 'error'}>
              {captureResult.message}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stripe
// ═══════════════════════════════════════════════════════════════════════════
function StripePaymentForm({ token, patientId, appointmentId, amount, currency, type, notes, onDone }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState(null);
  const [creating, setCreating]         = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleCreateIntent = async () => {
    if (!patientId || !amount) return;
    setCreating(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/payments/stripe/create-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ patientId: Number(patientId), appointmentId: appointmentId ? Number(appointmentId) : undefined, amount: Number(amount), currency, type, notes: notes || undefined }),
      });
      const data = await res.json();
      if (res.ok) setClientSecret(data.clientSecret);
      else setError(data.error || 'Erreur création paiement Stripe');
    } catch { setError('Erreur réseau'); }
    finally { setCreating(false); }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;
    setConfirming(true); setError('');
    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });
    if (confirmError) setError(confirmError.message || 'Erreur confirmation');
    else if (paymentIntent?.status === 'succeeded') { setSuccess(true); onDone(); }
    setConfirming(false);
  };

  if (!stripe && clientSecret) return <NoStripeKey />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error   && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">Paiement confirmé avec succès.</Alert>}

      {!clientSecret ? (
        <>
          <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
            Un intent de paiement Stripe sera créé. Vous pourrez ensuite saisir les informations de carte.
          </p>
          <button
            style={{ ...S.btnPrimary, width: '100%', background: 'linear-gradient(135deg, #635bff 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99,91,255,0.35)' }}
            onClick={handleCreateIntent} disabled={creating || !patientId || !amount}
          >
            <CreditCard size={15} /> {creating ? 'Préparation…' : 'Continuer vers le paiement par carte'}
          </button>
        </>
      ) : (
        <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={S.label}>Informations de carte</label>
            {/* Conteneur Stripe — fond solide obligatoire (iframe cross-origin, pas de CSS vars) */}
            <div style={{ padding: '14px', background: '#0f172a', border: '1px solid rgba(99,91,255,0.35)', borderRadius: '10px', minHeight: '50px' }}>
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#475569' }}>
            <Shield size={11} /> Paiement chiffré — vos données ne transitent pas par nos serveurs
          </div>
          <button
            type="submit"
            style={{ ...S.btnPrimary, width: '100%', background: 'linear-gradient(135deg, #635bff 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99,91,255,0.35)' }}
            disabled={!stripe || confirming}
          >
            <CreditCard size={15} />
            {confirming ? 'Confirmation…' : `Payer ${Number(amount || 0).toFixed(2)} ${currency}`}
          </button>
        </form>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Cabinet
// ═══════════════════════════════════════════════════════════════════════════
function CabinetPaymentForm({ token, method, patientId, appointmentId, amount, currency, type, notes, onDone }) {
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const m = methodMap[method] || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId || !amount) return;
    setSaving(true); setError(''); setSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/payments/cabinet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ patientId: Number(patientId), appointmentId: appointmentId ? Number(appointmentId) : undefined, amount: Number(amount), currency, method, type, notes: notes || undefined }),
      });
      const data = await res.json();
      if (res.ok) { setSuccess(true); onDone(); }
      else setError(data.error || "Erreur enregistrement");
    } catch { setError('Erreur réseau'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error   && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">Paiement enregistré et confirmé.</Alert>}
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '0.82rem', color: '#64748b', lineHeight: '1.6' }}>
        Le paiement sera immédiatement marqué <strong style={{ color: '#10b981' }}>Complété</strong>. À utiliser uniquement après réception effective au cabinet.
      </div>
      <button
        type="submit"
        style={{ ...S.btnPrimary, width: '100%', background: `linear-gradient(135deg, ${m.color || '#0ea5e9'} 0%, #0284c7 100%)`, boxShadow: `0 4px 14px ${m.bg || 'rgba(14,165,233,0.3)'}` }}
        disabled={saving || !patientId || !amount}
      >
        <CheckCircle2 size={15} /> {saving ? 'Enregistrement…' : 'Confirmer la réception du paiement'}
      </button>
    </form>
  );
}