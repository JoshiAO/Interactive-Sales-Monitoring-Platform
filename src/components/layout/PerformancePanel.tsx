import React, { useState } from 'react';
import { useDashboardData } from '../../hooks/useDashboardData';
import { Loader2, Settings, X, Medal, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUsersCache } from '../../hooks/useUsersCache';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import SalesmanPerformanceModal from './SalesmanPerformanceModal';

const PerformancePanel: React.FC<{ className?: string; style?: React.CSSProperties; isMobileView?: boolean }> = ({ className = '', style, isMobileView = false }) => {
  const { role, salesmanId } = useAuth();
  const { usersCache } = useUsersCache();
  const [activeTab, setActiveTab] = useState<'STT' | 'UBA' | 'VD30'>('STT');
  const [serviceModel, setServiceModel] = useState<'Ex-Truck' | 'Booking'>('Ex-Truck');
  const [showSettings, setShowSettings] = useState(false);
  const [newExclusion, setNewExclusion] = useState('');
  const [newVd30Exclusion, setNewVd30Exclusion] = useState('');
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [isCollapsed, setIsCollapsed] = useState(!isMobileView);

  const { loading, data } = useDashboardData('all', false);

  if (loading) {
    return (
      <aside className={`glass-panel performance-panel ${className}`} style={{ width: '100%', maxWidth: '380px', flexShrink: 0, borderLeft: '1px solid var(--border)', borderRadius: 0, padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <Loader2 size={24} className="animate-spin" color="var(--accent-primary)" />
      </aside>
    );
  }

  const excludedHouseAccounts = data.excludedSalesmen || [];
  const excludedVd30Accounts = data.excludedVd30Salesmen || [];

  const eligibleSalesmen = [...data.salesmen]
    .filter(s => {
      if (activeTab === 'VD30') {
        if (!s.vd30 || s.vd30 <= 0) return false;
        if (excludedVd30Accounts.includes(s.id)) return false;
      } else {
        if (activeTab === 'STT' && (!s.mtdSales || s.mtdSales <= 0)) return false;
        if (activeTab === 'UBA' && (!s.uba || s.uba <= 0)) return false;
        if (excludedHouseAccounts.includes(s.id)) return false;
      }

      const today = new Date();
      const date = today.getDate();
      const currentWeek = Math.min(Math.ceil(date / 7), 5);

      const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
      const commitments = (supervisor && data.weeklyCommitments) ? data.weeklyCommitments[supervisor.uid] : null;
      let teamCommitment = 0;
      let isApproved = false;

      if (commitments && commitments[activeTab.toLowerCase()] && commitments[activeTab.toLowerCase()][currentWeek.toString()]) {
        const weekData = commitments[activeTab.toLowerCase()][currentWeek.toString()];

        let hasOverride = false;
        if (weekData.overrides) {
          Object.values(weekData.overrides).forEach((overrideGrp: any) => {
            if (overrideGrp.salesmen && overrideGrp.salesmen.includes(s.id)) {
              teamCommitment = overrideGrp.target;
              hasOverride = true;
            }
          });
        }

        if (!hasOverride) {
          teamCommitment = weekData.target || 0;
        }

        isApproved = weekData.status === 'approved';
      }

      if (!isApproved) {
        return false;
      }

      const sttPct = (s.mtdSales / (s.target || 1)) * 100;
      const ubaPct = (s.uba / (s.ubaTarget || 1)) * 100;
      const vd30Pct = (s.vd30 / (s.vd30Target || 1)) * 100;

      const actualPct = activeTab === 'STT' ? sttPct : activeTab === 'UBA' ? ubaPct : vd30Pct;

      if (actualPct < teamCommitment) {
        return false;
      }

      if (commitments && commitments[activeTab.toLowerCase()]) {
        const trajectory = [];
        for (let i = 1; i <= 5; i++) {
          const wData = commitments[activeTab.toLowerCase()][i.toString()];
          trajectory.push(wData && wData.status === 'approved' ? wData.target : null);
        }
        s._commitmentTrajectory = trajectory;
      } else {
        s._commitmentTrajectory = [0, 0, 0, 0, 0];
      }

      return true;
    })
    .sort((a, b) => {
      if (activeTab === 'STT') {
        return (b.mtdSales / (b.target || 1)) - (a.mtdSales / (a.target || 1));
      } else if (activeTab === 'UBA') {
        return (b.uba / (b.ubaTarget || 1)) - (a.uba / (a.ubaTarget || 1));
      } else {
        return (b.vd30 / (b.vd30Target || 1)) - (a.vd30 / (a.vd30Target || 1));
      }
    });


  let displayExTruck: any[] = [];
  let displayBooking: any[] = [];

  if (role === 'admin' || role === 'manager') {
    // Top 10 Ex-Truck + Top 10 Booking
    displayExTruck = eligibleSalesmen.filter(s => s.type === 'Ex-Truck').slice(0, 10);
    displayBooking = eligibleSalesmen.filter(s => s.type === 'Booking').slice(0, 10);
  } else if (role === 'supervisor') {
    // Supervisor sees Top 10 of their team
    displayExTruck = eligibleSalesmen.filter(s => s.type === 'Ex-Truck').slice(0, 10);
    displayBooking = eligibleSalesmen.filter(s => s.type === 'Booking').slice(0, 10);
  } else {
    // Salesman locked to their own type
    const myType = data.salesmen.find((s: any) => s.id === salesmanId)?.type || 'Ex-Truck';
    if (myType === 'Ex-Truck') {
      displayExTruck = eligibleSalesmen.filter(s => s.type === 'Ex-Truck').slice(0, 10);
    } else {
      displayBooking = eligibleSalesmen.filter(s => s.type === 'Booking').slice(0, 10);
    }
  }


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
    <div style={{ position: 'relative', display: 'flex', flexShrink: 0, height: '100%', flex: isMobileView ? 1 : undefined }} className={`performance-panel-wrapper ${className}`}>

      {/* The Arrow Button sits outside the overflow: hidden container */}
      {!isMobileView && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ position: 'absolute', top: '50%', left: '-14px', width: '28px', height: '48px', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 50, color: 'var(--text-muted)' }}
          title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
        >
          {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      )}

      {/* The Animating Container */}
      <aside className="glass-panel" style={{ width: isMobileView ? '100%' : (isCollapsed ? '48px' : '380px'), flexShrink: 0, borderLeft: '1px solid var(--border)', borderRadius: 0, position: 'relative', transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-panel)', ...style }}>

        {/* --- Collapsed Content --- */}
        <div style={{ width: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '24px', position: 'absolute', top: 0, left: 0, bottom: 0, opacity: isCollapsed ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: isCollapsed ? 'auto' : 'none' }}>
          <button onClick={() => setIsCollapsed(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} title="Expand Performance Panel">
            <Medal size={24} style={{ color: 'var(--accent-primary)' }} />
          </button>
        </div>

        {/* --- Expanded Content --- */}
        <div style={{ width: isMobileView ? '100%' : '370px', flex: 1, overflowY: 'auto', overflowX: 'hidden', opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s', pointerEvents: isCollapsed ? 'none' : 'auto' }}>
          <div style={{ width: isMobileView ? '100%' : '90%', margin: '0 auto', padding: '4px 24px 24px 0px', display: 'flex', flexDirection: 'column', minHeight: '100%', boxSizing: 'border-box' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, lineHeight: 1 }}>Performance</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '4px 0 0 0' }}>Top 10 Salesmen</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {role === 'admin' && (
                  <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                    <Settings size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ width: '100%', display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', overflowX: 'auto', boxSizing: 'border-box' }}>
              <button
                onClick={() => setActiveTab('STT')}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'STT' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'STT' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                STT Index
              </button>
              <button
                onClick={() => setActiveTab('UBA')}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'UBA' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'UBA' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                UBA Index
              </button>
              <button
                onClick={() => setActiveTab('VD30')}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'VD30' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'VD30' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                VD30 Index
              </button>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
              {(displayExTruck.length === 0 && displayBooking.length === 0) && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                  No eligible salesmen found.
                </div>
              )}

              {(() => {
                const renderSalesmanCard = (salesman: any, rank: number) => {
                  const sttPct = ((salesman.mtdSales / (salesman.target || 1)) * 100).toFixed(1);
                  const ubaPct = ((salesman.uba / (salesman.ubaTarget || 1)) * 100).toFixed(1);
                  const vd30Pct = ((salesman.vd30 / (salesman.vd30Target || 1)) * 100).toFixed(1);
                  const displayPct = activeTab === 'STT' ? sttPct : activeTab === 'UBA' ? ubaPct : vd30Pct;

                  const isSuccess = activeTab === 'VD30' ? salesman.vd30 >= salesman.vd30Target && salesman.vd30Target > 0 : parseFloat(displayPct) >= 100;
                  const displayValue = activeTab === 'VD30' ? `${salesman.vd30}/${salesman.vd30Target}` : `${displayPct}%`;

                  let borderColor = 'transparent';
                  if (rank === 1) borderColor = '#FBBF24';
                  else if (rank === 2) borderColor = '#9CA3AF';
                  else if (rank === 3) borderColor = '#B45309';

                  const ach = salesman.achievements || { gold: 0, silver: 0, bronze: 0 };

                  return (
                    <div key={salesman.id} className={`glass-panel interactive`}
                      onClick={() => setSelectedSalesman(salesman)}
                      style={{
                        padding: '12px', display: 'flex', alignItems: 'center', gap: '12px',
                        border: `1px solid ${borderColor !== 'transparent' ? borderColor : 'var(--border)'}`,
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}>

                      {/* Giant Medal Watermark */}
                      {rank <= 3 && (
                        <div style={{ position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)', opacity: 0.04, zIndex: 0 }}>
                          <Medal size={120} color={borderColor} fill={borderColor} />
                        </div>
                      )}

                      <div style={{ position: 'relative', zIndex: 1 }}>
                        {salesman.photoURL ? (
                          <img src={salesman.photoURL} alt={salesman.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${borderColor !== 'transparent' ? borderColor : 'rgba(255,255,255,0.1)'}` }} />
                        ) : (
                          <div style={{
                            width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '20px', border: `2px solid ${borderColor !== 'transparent' ? borderColor : 'rgba(255,255,255,0.1)'}`
                          }}>
                            {salesman.name.charAt(0)}
                          </div>
                        )}
                        {/* Avatar Rank Badge */}
                        <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', backgroundColor: borderColor !== 'transparent' ? borderColor : 'var(--bg-dark)', borderRadius: '12px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', fontWeight: 'bold', color: borderColor !== 'transparent' ? 'var(--bg-dark)' : 'var(--text-muted)', border: '2px solid var(--bg-dark)', zIndex: 2 }}>
                          {rank <= 3 && <Medal size={10} fill="currentColor" color="transparent" />}
                          <span>{rank}</span>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>
                          {salesman.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {salesman.id} • {salesman.type}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: isSuccess ? 'var(--accent-success)' : 'var(--text-main)', zIndex: 1, marginRight: '8px' }}>
                        {displayValue}
                      </div>

                      {/* Weekly Medal History */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', zIndex: 1, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Medal size={12} fill="#FBBF24" color="#B45309" />
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#FBBF24', width: '12px' }}>{ach.gold}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Medal size={12} fill="#9CA3AF" color="#4B5563" />
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#9CA3AF', width: '12px' }}>{ach.silver}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Medal size={12} fill="#B45309" color="#78350F" />
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#B45309', width: '12px' }}>{ach.bronze}</span>
                        </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {serviceModel === 'Ex-Truck' && displayExTruck.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {displayExTruck.map((s, idx) => renderSalesmanCard(s, idx + 1))}
                      </div>
                    )}
                    {serviceModel === 'Booking' && displayBooking.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {displayBooking.map((s, idx) => renderSalesmanCard(s, idx + 1))}
                      </div>
                    )}
                  </>
                );
              })()}
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
                    </div>
                  </div>

                </div>
              </div>
            )}

            {selectedSalesman && (
              <SalesmanPerformanceModal
                salesman={selectedSalesman}
                rawAchievements={data.rawAchievements}
                rawDailyPoints={data.rawDailyPoints}
                onClose={() => setSelectedSalesman(null)}
              />
            )}
          </div> {/* End of Inner Padding Wrapper */}
        </div> {/* End of Expanded Content */}

        {/* Absolute Hovering Service Model Selector */}
        {!isCollapsed && (
          <div style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 30 }}>
            <div style={{ display: 'flex', gap: '8px', width: '90%', maxWidth: '300px', padding: '8px', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
              <button
                onClick={() => setServiceModel('Ex-Truck')}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', background: serviceModel === 'Ex-Truck' ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)', color: serviceModel === 'Ex-Truck' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px', fontWeight: 600 }}
              >
                Ex-Truck
              </button>
              <button
                onClick={() => setServiceModel('Booking')}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', background: serviceModel === 'Booking' ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)', color: serviceModel === 'Booking' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '13px', fontWeight: 600 }}
              >
                Booking
              </button>
            </div>
          </div>
        )}

      </aside>
    </div>
  );
};

export default PerformancePanel;
