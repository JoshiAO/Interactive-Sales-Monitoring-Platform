import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, ShoppingCart, Target, Users, Database, Settings, LogOut, Menu, X, BarChart2 } from 'lucide-react';
import { logout } from '../../firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PerformancePanel from './PerformancePanel';

const Layout: React.FC = () => {
  const { role, currentUser, name, photoURL, salesmanId } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [cobDate, setCobDate] = useState<string>('');

  const savedAchievements = localStorage.getItem('salesman_achievements');
  const points = savedAchievements && salesmanId ? JSON.parse(savedAchievements)[salesmanId]?.points || 0 : 0;
  const fireClass = points >= 15 ? 'fire-blue' : points >= 10 ? 'fire-orange' : points >= 5 ? 'fire-red' : '';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().cobDate) {
        setCobDate(docSnap.data().cobDate);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const navLinks = (
    <nav style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px', paddingBottom: '8px' }}>
        <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
          <LayoutDashboard size={18} /> Home
        </NavLink>
        <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/sales" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
          <ShoppingCart size={18} /> Sales
        </NavLink>
        <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/vd30" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
          <Target size={18} /> VD30
        </NavLink>
        <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/customers" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
          <Users size={18} /> Customers
        </NavLink>

        {/* Under Development Tabs */}
        <div className="btn" style={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }} title="Under Development">
          <Target size={18} /> NPD
        </div>
        <div className="btn" style={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }} title="Under Development">
          <Target size={18} /> Promo Packs
        </div>
        <div className="btn" style={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }} title="Under Development">
          <Target size={18} /> Ageing
        </div>
        <div className="btn" style={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.2)', cursor: 'not-allowed' }} title="Under Development">
          <Target size={18} /> B.O.
        </div>
      </div>
      
      {role === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ margin: '8px 0', height: '1px', background: 'var(--border)' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '12px' }}>ADMIN</div>
          <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/data" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
            <Database size={18} /> Data Upload
          </NavLink>
          <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/users" className="btn" style={({isActive}) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
            <Settings size={18} /> Users
          </NavLink>
        </div>
      )}
    </nav>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      
      {/* Mobile Top Header */}
      <header className="glass-panel desktop-hidden" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50, borderBottom: '1px solid var(--border)', borderRadius: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => setIsMobileMenuOpen(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)' }}>
            <Menu size={24} />
          </button>
          <h2 style={{ color: 'var(--accent-primary)', fontSize: '18px', margin: 0 }}>Sales Monitoring</h2>
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay */}
      <div className={`desktop-hidden mobile-overlay ${isMobileMenuOpen ? 'open' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
        <aside className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ color: 'var(--accent-primary)', fontSize: '20px', margin: '0 0 16px 0' }}>Sales Monitoring</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {photoURL ? (
                <img src={photoURL} alt="Avatar" className={fireClass} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
              ) : (
                <div className={fireClass} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div>
                {name && <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>Role: {role || 'Guest'}</div>
                {cobDate && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>COB Date: <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{cobDate}</span></div>}
              </div>
            </div>
          </div>
          
          {navLinks}
            
            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '16px', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.email}</div>
              <button onClick={handleLogout} className="btn" style={{ width: '100%', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', marginBottom: '16px' }}>
                <LogOut size={16} /> Logout
              </button>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
                &copy; 2026 Joshua Alforque Ocampo.<br />All Rights Reserved.
              </div>
            </div>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="glass-panel mobile-hidden" style={{ width: '250px', borderRight: '1px solid var(--border)', borderRadius: 0, padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ color: 'var(--accent-primary)', fontSize: '20px', margin: '0 0 16px 0' }}>Sales Monitoring</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className={fireClass} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
            ) : (
              <div className={fireClass} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                {name ? name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div>
              {name && <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                Role: {role || 'Guest'}
              </div>
              {cobDate && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>COB Date: <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{cobDate}</span></div>}
            </div>
          </div>
        </div>
        
        {navLinks}
        
        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: '16px', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentUser?.email}
          </div>
          <button onClick={handleLogout} className="btn" style={{ width: '100%', backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', marginBottom: '16px' }}>
            <LogOut size={16} /> Logout
          </button>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.4' }}>
            &copy; 2026 Joshua Alforque Ocampo.<br />All Rights Reserved.
          </div>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }} className="mobile-pt">
        <Outlet />
      </main>
      
      {/* Desktop Performance Panel */}
      <PerformancePanel className="mobile-hidden" />

      {/* Mobile Floating Action Button (FAB) */}
      <button 
        className="desktop-hidden interactive"
        onClick={() => setIsPerformanceModalOpen(true)}
        style={{ position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 40 }}
      >
        <BarChart2 size={24} />
      </button>

      {/* Mobile Performance Modal */}
      {isPerformanceModalOpen && (
        <div className="desktop-hidden animate-fade-in-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
            <button onClick={() => setIsPerformanceModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
              <X size={24} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Render the panel without its built-in width/border constraints, passing a special class or overriding styles if needed. But our PerformancePanel currently uses max-width 300px. Let's wrap it in a flex container that centers it. */}
            <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
              <PerformancePanel className="" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
