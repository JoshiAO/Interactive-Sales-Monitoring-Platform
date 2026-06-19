import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, TrendingUp, PhilippinePeso, Activity, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useNpdPromoData } from '../../hooks/useNpdPromoData';
import { useTeams } from '../../hooks/useTeams';
import { Navigate } from 'react-router-dom';
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const Home: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const { loading, data } = useDashboardData(selectedTeam);
  const { loading: npdLoading, items: npdItems } = useNpdPromoData(selectedTeam);

  const npdTotals = { stt: 0, volume: 0, uba: 0 };
  const promoTotals = { stt: 0, volume: 0, uba: 0 };

  npdItems.forEach(item => {
    if (item.type === 'NPD') {
      npdTotals.stt += item.stt || 0;
      npdTotals.volume += item.volume || 0;
      npdTotals.uba += item.uba || 0;
    } else if (item.type?.toUpperCase().includes('PROMO')) {
      promoTotals.stt += item.stt || 0;
      promoTotals.volume += item.volume || 0;
      promoTotals.uba += item.uba || 0;
    }
  });

  if (role === 'warehouse_supervisor') {
    return <Navigate to="/ageing" replace />;
  }
  
  if ((loading && data.salesmen.length === 0) || (npdLoading && npdItems.length === 0)) {
    return (
      <div className="flex-center" style={{ height: '50vh', color: 'var(--accent-primary)' }}>
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const formatShortCurrency = (val: number) => {
    if (isNaN(val) || val == null) return '₱0';
    if (val >= 1_000_000) return `₱${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `₱${(val / 1_000).toFixed(2)}K`;
    return `₱${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };
  
  // Constrain VD30 data for the chart
  const vd30ChartData = data.vd30
    .filter(item => item.target > 0)
    .map(item => ({
      name: item.name,
      target: 100, // Background shadow bar
      actual: Math.min((item.actual / (item.target || 1)) * 100, 100) // Cap at 100%
    }));
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>Dashboard Overview</h2>
        {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {availableTeams.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTeam(t)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: '1px solid',
                  borderColor: selectedTeam === t ? 'var(--accent-primary)' : 'var(--border)',
                  backgroundColor: selectedTeam === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                  color: selectedTeam === t ? '#fff' : 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {t}
              </button>
            ))}
            {selectedTeam !== 'all' && (
              <button
                onClick={() => setSelectedTeam('all')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--accent-danger)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  marginLeft: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        <Card title="Target" value={formatCurrency(data.target)} icon={<Target size={20} />} subtitle="Monthly Goal" />
        <Card title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            MTD Sales
            <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{data.target > 0 ? ((data.mtdSales / data.target) * 100).toFixed(1) + '%' : '0.0%'}</span>
          </span>
        } value={formatCurrency(data.mtdSales)} icon={<PhilippinePeso size={20} />} subtitle="Current Month" />
        <Card title="Balance" value={formatCurrency(data.balance)} icon={<Activity size={20} />} subtitle="Remaining to Target" />
        <Card title="UBA" value={data.uba.toLocaleString()} icon={<TrendingUp size={20} />} subtitle="Unique Buying Accounts" />
      </div>

      {/* Charts Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
        
        {/* VD30 Bar Chart (Full Width) */}
        <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>VD30 Performance</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={vd30ChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Achieved']}
                />
                <Bar dataKey="target" fill="var(--bg-dark)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Grid for Pie Chart and Additional Metrics */}
        <div className="dashboard-grid">
          
          {/* Product Category Pie Chart */}
          <div className="glass-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>Product Category</h3>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={data.categories}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.categories.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'Value']}
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px', maxHeight: '120px', overflowY: 'auto', padding: '0 8px' }}>
            {data.categories.map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
          {/* Additional Metrics */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>Additional Metrics</h3>
            <div className="metrics-container">
              {/* Column 1 */}
              <div className="metrics-group">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customer Master List (CML)</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{data.cml.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>UBA Target</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{data.ubaTarget.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strike Rate</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{data.cml > 0 ? ((data.uba / data.cml) * 100).toFixed(1) : 0}%</div>
                </div>
              </div>

              {/* Column 2: NPD */}
              <div className="metrics-group">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>NPD Net Value</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-primary)' }} title={formatCurrency(npdTotals.stt)}>{formatShortCurrency(npdTotals.stt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Volume</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{npdTotals.volume.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>UBA</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{npdTotals.uba.toLocaleString()}</div>
                </div>
              </div>

              {/* Column 3: Promo Packs */}
              <div className="metrics-group">
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Promo packs Net Value</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-success)' }} title={formatCurrency(promoTotals.stt)}>{formatShortCurrency(promoTotals.stt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Volume</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{promoTotals.volume.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>UBA</div>
                  <div style={{ fontSize: '24px', fontWeight: 600 }}>{promoTotals.uba.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
