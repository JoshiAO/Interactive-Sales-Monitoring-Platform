import React from 'react';
import SalesmanPerformanceCard from './SalesmanPerformanceCard';
import { useAuth } from '../../contexts/AuthContext';
import { useUsersCache } from '../../hooks/useUsersCache';
import { getActiveWeeksCount } from '../../utils/dateUtils';

interface DualLeaderboardProps {
  data: any;
  activeTab: 'STT' | 'UBA' | 'VD30';
  currentWeek: number;
  selectedWeek: number;
}

const DualLeaderboard: React.FC<DualLeaderboardProps> = ({ data, activeTab, currentWeek, selectedWeek }) => {
  const { role, salesmanId } = useAuth();
  const { usersCache } = useUsersCache();

  const excludedHouseAccounts = data.excludedSalesmen || [];
  const excludedVd30Accounts = data.excludedVd30Salesmen || [];
  
  let eligibleSalesmen: any[] = [];

  const activeMetricKey = activeTab.toLowerCase();
  
  if (selectedWeek < currentWeek && data.rawAchievements && data.rawAchievements[selectedWeek]) {
    // Historical Snapshot
    const snapshotData = data.rawAchievements[selectedWeek];
    
    Object.keys(snapshotData).forEach(uid => {
      if (snapshotData[uid].metrics && snapshotData[uid].metrics[activeMetricKey]) {
        const metricData = snapshotData[uid].metrics[activeMetricKey];
        const s = data.salesmen.find((x: any) => x.id === uid);
        if (s) {
          const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
          const commitments = (supervisor && data.weeklyCommitments) ? data.weeklyCommitments[supervisor.uid] : null;
          let trajectory = [0,0,0,0,0];
          
          if (commitments && commitments[activeMetricKey]) {
            trajectory = [];
            const maxWeeks = getActiveWeeksCount(data.weekMapping);
            for (let i = 1; i <= maxWeeks; i++) {
              const wData = commitments[activeMetricKey][i.toString()];
              trajectory.push(wData && wData.status === 'approved' ? wData.target : null);
            }
          }

          eligibleSalesmen.push({
            ...s,
            _historicalActualPct: metricData.actualPct,
            _historicalRank: metricData.rank,
            _historicalMedal: metricData.medal,
            _isHistorical: true,
            _hasApprovedTarget: true,
            _commitmentTrajectory: trajectory
          });
        }
      }
    });
    
    eligibleSalesmen.sort((a, b) => a._historicalRank - b._historicalRank);
  } else {
    // Live Calculation
    eligibleSalesmen = [...data.salesmen]
      .filter((s: any) => {
        if (activeTab === 'VD30') {
          if (!s.vd30 || s.vd30 <= 0) return false;
          if (excludedVd30Accounts.includes(s.id)) return false;
        } else {
          if (activeTab === 'STT' && (!s.mtdSales || s.mtdSales <= 0)) return false;
          if (activeTab === 'UBA' && (!s.uba || s.uba <= 0)) return false;
          if (excludedHouseAccounts.includes(s.id)) return false;
        }

        const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
        const commitments = (supervisor && data.weeklyCommitments) ? data.weeklyCommitments[supervisor.uid] : null;
        let teamCommitment = 0;
        let isApproved = false;

        if (commitments && commitments[activeMetricKey] && commitments[activeMetricKey][selectedWeek.toString()]) {
          const weekData = commitments[activeMetricKey][selectedWeek.toString()];
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

        const sttPct = (s.mtdSales / (s.target || 1)) * 100;
        const ubaPct = (s.uba / (s.ubaTarget || 1)) * 100;
        const vd30Pct = (s.vd30 / (s.vd30Target || 1)) * 100;
        const actualVal = activeTab === 'STT' ? sttPct : activeTab === 'UBA' ? ubaPct : vd30Pct;

        s._hasApprovedTarget = isApproved;

        if (activeTab === 'STT') {
          if (isApproved && actualVal < teamCommitment) {
            return false;
          }
        }

        if (commitments && commitments[activeMetricKey]) {
          const trajectory = [];
          const maxWeeks = getActiveWeeksCount(data.weekMapping);
          for (let i = 1; i <= maxWeeks; i++) {
            const wData = commitments[activeMetricKey][i.toString()];
            trajectory.push(wData && wData.status === 'approved' ? wData.target : null);
          }
          s._commitmentTrajectory = trajectory;
        } else {
          s._commitmentTrajectory = Array(getActiveWeeksCount(data.weekMapping)).fill(0);
        }

        return true;
      })
      .sort((a, b) => {
        if (activeTab === 'STT') return (b.mtdSales / (b.target || 1)) - (a.mtdSales / (a.target || 1));
        else if (activeTab === 'UBA') return (b.uba / (b.ubaTarget || 1)) - (a.uba / (a.ubaTarget || 1));
        else return (b.vd30 / (b.vd30Target || 1)) - (a.vd30 / (a.vd30Target || 1));
      });
  }

  const exTruck = eligibleSalesmen.filter((s: any) => s.type === 'Ex-Truck').slice(0, 10);
  const booking = eligibleSalesmen.filter((s: any) => s.type === 'Booking').slice(0, 10);

  const myType = data.salesmen.find((s:any) => s.id === salesmanId)?.type || 'Ex-Truck';
  
  const showExTruck = role !== 'salesman' || myType === 'Ex-Truck';
  const showBooking = role !== 'salesman' || myType === 'Booking';

  const renderSalesman = (s: any, idx: number) => {
    let metTarget = false;
    if (s._isHistorical) {
      metTarget = s._historicalMedal !== 'none';
    } else {
      const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
      const commitments = (supervisor && data.weeklyCommitments) ? data.weeklyCommitments[supervisor.uid] : null;
      let teamCommitment = 0;
      if (commitments && commitments[activeMetricKey] && commitments[activeMetricKey][selectedWeek.toString()]) {
         teamCommitment = commitments[activeMetricKey][selectedWeek.toString()].target || 0;
      }
      const actualVal = activeTab === 'STT' 
        ? ((s.mtdSales / (s.target || 1)) * 100) 
        : activeTab === 'UBA' 
          ? ((s.uba / (s.ubaTarget || 1)) * 100) 
          : ((s.vd30 / (s.vd30Target || 1)) * 100);
      metTarget = actualVal >= teamCommitment;
    }

    return (
      <SalesmanPerformanceCard 
        key={s.id} 
        salesman={s} 
        rank={idx + 1} 
        activeTab={activeTab} 
        currentWeek={selectedWeek}
        commitmentTrajectory={s._commitmentTrajectory}
        metTarget={metTarget}
        hasApprovedTarget={s._hasApprovedTarget}
      />
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: showExTruck && showBooking ? '1fr 1fr' : '1fr', gap: '24px' }} className="responsive-grid-leaderboard">
      
      {showExTruck && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ color: 'var(--accent-primary)', margin: 0, paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>Ex-Truck Top 10</h2>
          {exTruck.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No eligible Ex-Truck salesmen for this week's ranking.
            </div>
          ) : (
            exTruck.map(renderSalesman)
          )}
        </div>
      )}

      {showBooking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ color: 'var(--accent-primary)', margin: 0, paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>Booking Top 10</h2>
          {booking.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No eligible Booking salesmen for this week's ranking.
            </div>
          ) : (
            booking.map(renderSalesman)
          )}
        </div>
      )}

    </div>
  );
};

export default DualLeaderboard;
