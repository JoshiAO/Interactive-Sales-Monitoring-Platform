import React from 'react';
import { Medal, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesmanPerformanceCardProps {
  salesman: any;
  rank: number;
  activeTab: string;
  commitmentTrajectory: number[]; // e.g. [17, 43, 73, 100]
  currentWeek: number;
  metTarget?: boolean;
  hasApprovedTarget?: boolean;
}

const SalesmanPerformanceCard: React.FC<SalesmanPerformanceCardProps> = ({ salesman, rank, activeTab, commitmentTrajectory, currentWeek, metTarget = true, hasApprovedTarget = true }) => {
  const isHistorical = salesman._isHistorical;
  
  const sttPct = isHistorical ? salesman._historicalActualPct.toFixed(1) : ((salesman.mtdSales / (salesman.target || 1)) * 100).toFixed(1);
  const ubaPct = isHistorical ? salesman._historicalActualPct.toFixed(1) : ((salesman.uba / (salesman.ubaTarget || 1)) * 100).toFixed(1);
  const vd30Pct = isHistorical ? salesman._historicalActualPct.toFixed(1) : ((salesman.vd30 / (salesman.vd30Target || 1)) * 100).toFixed(1);
  
  const displayPct = activeTab === 'STT' ? sttPct : activeTab === 'UBA' ? ubaPct : vd30Pct;
  const isSuccess = activeTab === 'VD30' && !isHistorical ? salesman.vd30 >= salesman.vd30Target && salesman.vd30Target > 0 : parseFloat(displayPct) >= 100;
  
  let displayValue = `${displayPct}%`;
  if (activeTab === 'VD30' && !isHistorical) {
    displayValue = `${salesman.vd30}/${salesman.vd30Target}`;
  }

  const points = salesman.achievements?.points || 0;
  const gold = salesman.achievements?.gold || 0;
  const silver = salesman.achievements?.silver || 0;
  const bronze = salesman.achievements?.bronze || 0;

  let borderColor = 'transparent';
  if (metTarget && hasApprovedTarget) {
    if (isHistorical) {
      const medal = salesman._historicalMedal;
      if (medal === 'gold') borderColor = '#FBBF24';
      else if (medal === 'silver') borderColor = '#9CA3AF';
      else if (medal === 'bronze') borderColor = '#B45309';
    } else {
      if (rank === 1) borderColor = '#FBBF24'; // Gold
      else if (rank === 2) borderColor = '#9CA3AF'; // Silver
      else if (rank === 3) borderColor = '#B45309'; // Bronze
    }
  }

  // Prepare chart data
  const chartData = commitmentTrajectory.map((target, idx) => {
    const weekNum = idx + 1;
    // We only have the current actual pacing, so we plot it if weekNum <= currentWeek
    // If it's the exact current week, we plot the current displayPct
    // For past weeks, ideally we'd have historical data, but for now we extrapolate or just plot the current
    let actual: number | null = null;
    if (weekNum === currentWeek) {
      actual = parseFloat(displayPct);
    }

    return {
      name: `W${weekNum}`,
      target,
      actual
    };
  });

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: `1px solid ${borderColor}`, position: 'relative', overflow: 'hidden' }}>
      
      {/* Top Section: Info & Trophy Case */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ position: 'relative' }}>
          {salesman.photoURL ? (
            <img src={salesman.photoURL} alt={salesman.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${borderColor}` }} />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', border: `2px solid ${borderColor}` }}>
              {salesman.name.charAt(0)}
            </div>
          )}
          {metTarget && hasApprovedTarget && rank <= 3 && (
            <div style={{ position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-dark)', borderRadius: '12px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 'bold', border: `1px solid ${borderColor}`, color: borderColor, zIndex: 2 }}>
              <Medal size={14} fill={borderColor} color="var(--bg-dark)" />
              <span>{rank}</span>
            </div>
          )}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: '600' }}>{salesman.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{salesman.id} • {salesman.type}</div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isSuccess ? 'var(--accent-success)' : 'var(--text-main)' }}>
              {displayValue}
            </div>
          </div>
        </div>

        {/* Trophy Case */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trophy size={12} /> Monthly Medals
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Medal size={16} fill="#FFD700" color="#B8860B" />
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#FFD700' }}>{gold}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Medal size={16} fill="#C0C0C0" color="#808080" />
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#C0C0C0' }}>{silver}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Medal size={16} fill="#CD7F32" color="#8B4513" />
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#CD7F32' }}>{bronze}</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 'bold', marginTop: '4px' }}>
            {points} Total Points
          </div>
        </div>
      </div>

      {/* Skewing Chart */}
      <div style={{ height: '140px', width: '100%', marginTop: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Skewing (Pacing vs Commitment)</div>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ padding: 0 }}
              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, '']}
            />
            <Line type="monotone" dataKey="target" stroke="rgba(255,255,255,0.2)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Commitment" />
            <Line type="monotone" dataKey="actual" stroke="var(--accent-primary)" strokeWidth={3} dot={{ fill: 'var(--accent-primary)', r: 4 }} name="Actual" />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default SalesmanPerformanceCard;
