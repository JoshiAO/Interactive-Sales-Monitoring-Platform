import React, { useState } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { Loader2, Settings, X, Medal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const PerformancePanel: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<'STT' | 'UBA' | 'VD30'>('STT');
  const [viewMode, setViewMode] = useState<'team' | 'general'>('general');
  const [showSettings, setShowSettings] = useState(false);
  const [newExclusion, setNewExclusion] = useState('');
  const [newVd30Exclusion, setNewVd30Exclusion] = useState('');
  
  const { loading, data } = useDashboardData('all', viewMode === 'general');

  if (loading) {
    return (
      <aside className={`glass-panel performance-panel ${className}`} style={{ width: '100%', maxWidth: '300px', flexShrink: 0, borderLeft: '1px solid var(--border)', borderRadius: 0, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="animate-spin" color="var(--accent-primary)" />
      </aside>
    );
  }

  // Use dynamic exclusion list from Firestore
  const excludedHouseAccounts = data.excludedSalesmen || [];
  const excludedVd30Accounts = data.excludedVd30Salesmen || [];
  
  const sortedSalesmen = [...data.salesmen]
    .filter(s => {
      if (activeTab === 'VD30') {
        if (!s.vd30 || s.vd30 <= 0) return false;
        return !excludedVd30Accounts.includes(s.id);
      }
      if (activeTab === 'STT' && (!s.mtdSales || s.mtdSales <= 0)) return false;
      if (activeTab === 'UBA' && (!s.uba || s.uba <= 0)) return false;
      return !excludedHouseAccounts.includes(s.id);
    })
    .sort((a, b) => {
      if (activeTab === 'STT') {
        return (b.mtdSales / (b.target || 1)) - (a.mtdSales / (a.target || 1));
      } else if (activeTab === 'UBA') {
        return (b.uba / (b.ubaTarget || 1)) - (a.uba / (a.ubaTarget || 1));
      } else {
        return (b.vd30 / (b.vd30Target || 1)) - (a.vd30 / (a.vd30Target || 1));
      }
    }).slice(0, 10);

  const handleAddExclusion = async () => {
    if (!newExclusion.trim()) return;
    const updated = [...excludedHouseAccounts, newExclusion.trim()];
    await setDoc(doc(db, 'settings', 'performance_panel'), { excluded_salesmen: updated }, { merge: true });
    setNewExclusion('');
    window.location.reload(); 
  };

  const handleRemoveExclusion = async (id: string) => {
    const updated = excludedHouseAccounts.filter(s => s !== id);
    await setDoc(doc(db, 'settings', 'performance_panel'), { excluded_salesmen: updated }, { merge: true });
    window.location.reload();
  };

  const handleAddVd30Exclusion = async () => {
    if (!newVd30Exclusion.trim()) return;
    const updated = [...excludedVd30Accounts, newVd30Exclusion.trim()];
    await setDoc(doc(db, 'settings', 'performance_panel'), { excluded_vd30_salesmen: updated }, { merge: true });
    setNewVd30Exclusion('');
    window.location.reload(); 
  };

  const handleRemoveVd30Exclusion = async (id: string) => {
    const updated = excludedVd30Accounts.filter(s => s !== id);
    await setDoc(doc(db, 'settings', 'performance_panel'), { excluded_vd30_salesmen: updated }, { merge: true });
    window.location.reload();
  };

  return (
    <aside className={`glass-panel performance-panel ${className}`} style={{ width: '100%', maxWidth: '300px', borderLeft: '1px solid var(--border)', borderRadius: 0, padding: '24px', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, lineHeight: 1 }}>Performance</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>Top 10 Salesmen</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {role !== 'admin' && role !== 'manager' && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '12px' }}>
              <button 
                onClick={() => setViewMode('team')}
                style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === 'team' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'team' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}
              >
                Team
              </button>
              <button 
                onClick={() => setViewMode('general')}
                style={{ padding: '4px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: viewMode === 'general' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'general' ? 'white' : 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}
              >
                General
              </button>
            </div>
          )}
          {role === 'admin' && (
            <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px' }}>
        <button 
          onClick={() => setActiveTab('STT')}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'STT' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'STT' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px' }}
        >
          STT Index
        </button>
        <button 
          onClick={() => setActiveTab('UBA')}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'UBA' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'UBA' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px' }}
        >
          UBA Index
        </button>
        <button 
          onClick={() => setActiveTab('VD30')}
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'VD30' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'VD30' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px' }}
        >
          VD30 Index
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedSalesmen.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
            No salesmen with performance data yet for this category.
          </div>
        )}
        {sortedSalesmen.map((salesman, idx) => {
          const sttPct = ((salesman.mtdSales / (salesman.target || 1)) * 100).toFixed(1);
          const ubaPct = ((salesman.uba / (salesman.ubaTarget || 1)) * 100).toFixed(1);
          const vd30Pct = ((salesman.vd30 / (salesman.vd30Target || 1)) * 100).toFixed(1);
          const displayPct = activeTab === 'STT' ? sttPct : activeTab === 'UBA' ? ubaPct : vd30Pct;
          
          const isSuccess = activeTab === 'VD30' ? salesman.vd30 >= salesman.vd30Target && salesman.vd30Target > 0 : parseFloat(displayPct) >= 100;
          const displayValue = activeTab === 'VD30' ? `${salesman.vd30}/${salesman.vd30Target}` : `${displayPct}%`;
          
          let borderColor = 'transparent';
          if (idx === 0) borderColor = '#FBBF24'; // Gold
          else if (idx === 1) borderColor = '#9CA3AF'; // Silver
          else if (idx === 2) borderColor = '#B45309'; // Bronze

          return (
            <div key={salesman.id} className="glass-panel interactive" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: `1px solid ${borderColor}` }}>
              <div style={{ position: 'relative' }}>
                {salesman.photoURL ? (
                  <img src={salesman.photoURL} alt={salesman.name} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${borderColor}` }} />
                ) : (
                  <div style={{ 
                    width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                    background: idx < 3 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontWeight: 'bold', fontSize: '20px', border: `2px solid ${borderColor}`
                  }}>
                    {salesman.name.charAt(0)}
                  </div>
                )}
                <div style={{ 
                  position: 'absolute', bottom: '-6px', right: '-6px', 
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '12px', padding: '2px 6px',
                  display: 'flex', alignItems: 'center', gap: '2px',
                  fontSize: '11px', fontWeight: 'bold',
                  border: `1px solid ${idx < 3 ? borderColor : 'var(--border)'}`,
                  color: idx < 3 ? borderColor : 'white',
                  zIndex: 2
                }}>
                  {idx < 3 && <Medal size={12} fill={borderColor} color="var(--bg-dark)" />}
                  <span>{idx + 1}</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, marginLeft: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.2' }}>
                  {salesman.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {salesman.id}
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '16px', color: isSuccess ? 'var(--accent-success)' : 'var(--text-main)' }}>
                    {displayValue}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sortedSalesmen.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', marginTop: '32px' }}>
            No salesman data available.
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="animate-fade-in-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', width: '90%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Performance Panel Settings</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '15px' }}>STT & UBA Exclusions</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>Exclude salesmen (e.g. House Accounts) from ranking.</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Salesman ID (e.g. KNE0001)"
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button onClick={handleAddExclusion} style={{ padding: '8px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>
                  Add
                </button>
              </div>

              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {excludedHouseAccounts.map((id: string) => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <span>{id}</span>
                    <button onClick={() => handleRemoveExclusion(id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                  </div>
                ))}
                {excludedHouseAccounts.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No excluded salesmen.</div>
                )}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '24px 0' }} />

            <div>
              <h4 style={{ marginBottom: '8px', fontSize: '15px' }}>VD30 Exclusions</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>Separate exclusion list for VD30 rankings.</p>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Salesman ID (e.g. KNE0001)"
                  value={newVd30Exclusion}
                  onChange={(e) => setNewVd30Exclusion(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
                <button onClick={handleAddVd30Exclusion} style={{ padding: '8px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer' }}>
                  Add
                </button>
              </div>

              <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {excludedVd30Accounts.map((id: string) => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                    <span>{id}</span>
                    <button onClick={() => handleRemoveVd30Exclusion(id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                  </div>
                ))}
                {excludedVd30Accounts.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No excluded salesmen.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </aside>
  );
};

export default PerformancePanel;
