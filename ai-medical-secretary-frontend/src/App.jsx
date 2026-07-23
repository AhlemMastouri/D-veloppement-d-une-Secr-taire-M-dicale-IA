import React, { useState, useEffect } from 'react';
import { Activity, LayoutDashboard, Calendar, Users, Settings, Cpu, LogOut, User } from 'lucide-react';
import Login from './components/Login';
import DashboardTab from './components/DashboardTab';
import CalendarTab from './components/CalendarTab';
import PatientsTab from './components/PatientsTab';
import FAQTab from './components/FAQTab';
import SandboxTab from './components/SandboxTab';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  const handleLoginSuccess = (loggedInUser, userToken) => {
    setToken(userToken);
    setUser(loggedInUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  };

  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      
      {/* Visual Sleek Sidebar */}
      <aside style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: 'var(--sidebar-width)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        zIndex: 100
      }}>
        
        {/* App Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
          <Activity size={24} color="#0ea5e9" className="pulse-active" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(to right, #0ea5e9, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Secrétaire IA
          </h1>
        </div>

        {/* User profile details in sidebar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          padding: '12px 8px',
          borderRadius: '10px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          marginBottom: '28px'
        }}>
          <div style={{ height: '36px', width: '36px', background: 'rgba(14, 165, 233, 0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <User size={18} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <strong style={{ display: 'block', fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {user.role === 'DOCTOR' ? `${user.specialty || 'Médecin'}` : user.role === 'SECRETARY' ? 'Secrétaire' : user.role === 'PATIENT' ? 'Patient' : 'Administrateur'}
            </span>
          </div>
        </div>

        {/* Sidebar Menu selections */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            className="btn btn-outline" 
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              border: 'none',
              background: activeTab === 'dashboard' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            Tableau de bord
          </button>

          <button 
            className="btn btn-outline" 
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              border: 'none',
              background: activeTab === 'calendar' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              color: activeTab === 'calendar' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('calendar')}
          >
            <Calendar size={18} />
            Agenda médical
          </button>

          <button 
            className="btn btn-outline" 
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              border: 'none',
              background: activeTab === 'patients' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              color: activeTab === 'patients' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('patients')}
          >
            <Users size={18} />
            Dossiers patients
          </button>

          <button 
            className="btn btn-outline" 
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              border: 'none',
              background: activeTab === 'faq' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              color: activeTab === 'faq' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('faq')}
          >
            <Settings size={18} />
            Paramétrage IA
          </button>

          <button 
            className="btn btn-outline" 
            style={{
              justifyContent: 'flex-start',
              width: '100%',
              border: 'none',
              background: activeTab === 'sandbox' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
              color: activeTab === 'sandbox' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTab('sandbox')}
          >
            <Cpu size={18} />
            Sandbox IA
          </button>
        </nav>

        {/* Logout button at bottom */}
        <button 
          className="btn btn-outline" 
          onClick={handleLogout}
          style={{ justifyContent: 'flex-start', width: '100%', border: 'none', color: 'var(--danger)', marginTop: 'auto' }}
        >
          <LogOut size={18} />
          Se déconnecter
        </button>

      </aside>

      {/* Main active dashboard page view */}
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardTab token={token} />}
        {activeTab === 'calendar' && <CalendarTab token={token} />}
        {activeTab === 'patients' && <PatientsTab token={token} />}
        {activeTab === 'faq' && <FAQTab token={token} />}
        {activeTab === 'sandbox' && <SandboxTab token={token} />}
      </main>

    </div>
  );
}
