import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, ShoppingCart, Target, Users, Database, Settings, LogOut, Menu, BarChart2, Package, Clock, AlertTriangle, Medal, X } from 'lucide-react';
import { logout } from '../../firebase/auth';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import PerformancePanel from './PerformancePanel';
import { MonthPicker } from '../ui/MonthPicker';

const Layout: React.FC = () => {
  const { role, currentUser, name, photoURL, selectedMonth, setSelectedMonth } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPerformancePanelOpen, setIsPerformancePanelOpen] = useState(false);
  const [cobDate, setCobDate] = useState<string>('');
  const [systemAnnouncement, setSystemAnnouncement] = useState<string>('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    const fetchMonths = async () => {
      if (role === 'admin' || role === 'manager') {
        const snap = await getDocs(collection(db, 'snapshots'));
        const months = new Set<string>();
        snap.forEach(d => {
          if (!d.id.endsWith('_customers')) {
            months.add(d.id);
          }
        });
        const sorted = Array.from(months).sort((a,b) => b.localeCompare(a));
        setAvailableMonths(sorted);
      }
    };
    fetchMonths();
  }, [role]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.cobDate) setCobDate(data.cobDate);
        setSystemAnnouncement(data.systemAnnouncement || '');
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
        {role !== 'warehouse_supervisor' && (
          <>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <LayoutDashboard size={18} /> Home
            </NavLink>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/sales" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <ShoppingCart size={18} /> Sales
            </NavLink>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/vd30" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <Target size={18} /> VD30
            </NavLink>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/customers" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <Users size={18} /> Customers
            </NavLink>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/npd" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <Package size={18} /> NPD & Promo
            </NavLink>
          </>
        )}
        {role !== 'salesman' && (
          <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/ageing" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
            <Clock size={18} /> Ageing
          </NavLink>
        )}
        {selectedMonth === 'current' && (
          <>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/bo" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <AlertTriangle size={18} /> B.O.
            </NavLink>
            <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/performance" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
              <Medal size={18} /> Gamification
            </NavLink>
          </>
        )}
      </div>

      {role === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
          <div style={{ margin: '8px 0', height: '1px', background: 'var(--border)' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '12px' }}>ADMIN</div>
          <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/data" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
            <Database size={18} /> Data Upload
          </NavLink>
          <NavLink onClick={() => setIsMobileMenuOpen(false)} to="/users" className="btn" style={({ isActive }) => ({ justifyContent: 'flex-start', backgroundColor: isActive ? 'var(--bg-panel-hover)' : 'transparent', color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' })}>
            <Settings size={18} /> Users
          </NavLink>
        </div>
      )}
    </nav>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative' }}>

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
              <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }}>
                {photoURL ? (
                  <img src={photoURL} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)', position: 'relative', zIndex: 1 }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', position: 'relative', zIndex: 1 }}>
                    {name ? name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </div>
              <div>
                {name && <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  Role: {role === 'warehouse_supervisor' ? 'Warehouse Supervisor' : role || 'Guest'}
                </div>
                {cobDate && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>COB Date: <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{cobDate}</span></div>}
              </div>
            </div>
          </div>

          {(role === 'admin' || role === 'manager') && (
            <div style={{ padding: '0 12px 16px 12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 600 }}>Data View</div>
              <MonthPicker 
                selectedMonth={selectedMonth}
                availableMonths={availableMonths}
                onChange={setSelectedMonth}
              />
            </div>
          )}

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
            <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }}>
              {photoURL ? (
                <img src={photoURL} alt="Avatar" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-primary)', position: 'relative', zIndex: 1 }} />
              ) : (
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', position: 'relative', zIndex: 1 }}>
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div>
              {name && <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{name}</div>}
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                Role: {role === 'warehouse_supervisor' ? 'Warehouse Supervisor' : role || 'Guest'}
              </div>
              {cobDate && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>COB Date: <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>{cobDate}</span></div>}
            </div>
          </div>
        </div>

        {(role === 'admin' || role === 'manager') && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 600, paddingLeft: '8px' }}>Data View</div>
            <MonthPicker 
              selectedMonth={selectedMonth}
              availableMonths={availableMonths}
              onChange={setSelectedMonth}
            />
          </div>
        )}

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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {systemAnnouncement && (
          <div className="mobile-announcement" style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={20} className="flex-shrink-0" />
              <div className="marquee-container" style={{ flex: 1, fontSize: '15px', fontWeight: '500' }}>
                <div className="marquee-content">
                  <span style={{ marginRight: '8px', opacity: 0.8 }}>Announcement:</span>
                  {systemAnnouncement}
                </div>
              </div>
            </div>
          </div>
        )}
        <main style={{ flex: 1, padding: '24px', position: 'relative' }} className="mobile-pt">
          <Outlet />
        </main>
      </div>

      {/* Desktop Performance Panel */}
      <PerformancePanel className="mobile-hidden" />

      {/* Mobile Floating Action Button (FAB) */}
      <button
        className="desktop-hidden interactive"
        onClick={() => setIsPerformancePanelOpen(true)}
        style={{ position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 40 }}
      >
        <BarChart2 size={24} />
      </button>

      {/* Mobile Performance Panel Modal */}
      {isPerformancePanelOpen && (
        <div className="desktop-hidden" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
            onClick={() => setIsPerformancePanelOpen(false)}
          />
          <div style={{ position: 'relative', height: '100%', width: '100%', maxWidth: '100%', background: 'var(--bg-dark)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-dark)', zIndex: 10 }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>Performance Panel</h2>
              <button className="btn-icon" onClick={() => setIsPerformancePanelOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <PerformancePanel isMobileView={true} style={{ maxWidth: '100%', borderLeft: 'none', padding: '16px', flex: 1 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
