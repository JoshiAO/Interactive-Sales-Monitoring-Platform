import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { Loader2, AlertCircle } from 'lucide-react';
import DualLeaderboard from '../../components/performance/DualLeaderboard';
import CommitmentManager from '../../components/performance/CommitmentManager';
import { getCurrentWeek } from '../../utils/dateUtils';

const PerformancePage: React.FC = () => {
  const { role } = useAuth();
  const { loading, data, forceEvaluateGamification } = useDashboardData('all', false);
  const [activeTab, setActiveTab] = useState<'STT' | 'UBA' | 'VD30'>('STT');

  // Determine current week based on date and settings
  const currentWeek = getCurrentWeek(data.cobDate, data.weekMapping);

  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);

  if (loading) {
    return (
      <div className="flex-center min-h-screen">
        <Loader2 size={32} className="animate-spin" color="var(--accent-primary)" />
      </div>
    );
  }

  return (
    <>
      <div className="mobile-only" style={{ margin: '24px 24px 0 24px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-danger)', color: 'var(--text-main)', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <AlertCircle size={20} color="var(--accent-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
          <strong>Desktop/PC Required.</strong> This feature is highly optimized for wide screens and is unavailable for full use on mobile. Please switch to a desktop device for the best experience.
        </div>
      </div>
      <div className="page-container fade-in mobile-blur" style={{ padding: '24px', maxWidth: '1200px', minWidth: '1024px', margin: '0 auto', overflowX: 'auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '28px' }}>Performance & Gamification</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Weekly Commitments & Monthly Rankings</p>
        </div>
        <div style={{ background: 'var(--bg-panel)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Week</span>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>Week {currentWeek}</div>
          </div>
          {role === 'admin' && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to calculate the final Gamification rankings for Week ${selectedWeek}? Ensure you have uploaded the complete sales data for this week before proceeding.`)) {
                  try {
                    await forceEvaluateGamification(selectedWeek);
                    alert(`Week ${selectedWeek} Gamification Rankings have been successfully calculated and locked in!`);
                    window.location.reload();
                  } catch (e) {
                    console.error(e);
                  }
                }
              }}
              title={`Calculate Gamification Rankings for W${selectedWeek}`}
              style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--accent-danger)', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              Evaluate W{selectedWeek} Ranking
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Metric Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', overflowX: 'auto', width: 'fit-content' }}>
          <button 
            onClick={() => setActiveTab('STT')}
            style={{ padding: '8px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'STT' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'STT' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '14px', fontWeight: '600' }}
          >
            STT Index
          </button>
          <button 
            onClick={() => setActiveTab('UBA')}
            style={{ padding: '8px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'UBA' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'UBA' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '14px', fontWeight: '600' }}
          >
            UBA Index
          </button>
          <button 
            onClick={() => setActiveTab('VD30')}
            style={{ padding: '8px 24px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: activeTab === 'VD30' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'VD30' ? 'white' : 'var(--text-muted)', transition: 'all 0.2s', fontSize: '14px', fontWeight: '600' }}
          >
            VD30 Index
          </button>
        </div>
        
        {/* Week Selector */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', overflowX: 'auto', width: 'fit-content' }}>
          {[1, 2, 3, 4, 5].map(w => (
            <button
              key={w}
              onClick={() => setSelectedWeek(w)}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: selectedWeek === w ? 'var(--accent-primary)' : 'transparent',
                color: selectedWeek === w ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              W{w}
            </button>
          ))}
        </div>
      </div>

      {(role === 'supervisor' || role === 'manager' || role === 'admin') && (
        <div style={{ marginBottom: '40px' }}>
          <CommitmentManager data={data} activeTab={activeTab} selectedWeek={selectedWeek} />
        </div>
      )}

      <DualLeaderboard data={data} activeTab={activeTab} currentWeek={currentWeek} selectedWeek={selectedWeek} />

      </div>
    </>
  );
};

export default PerformancePage;
