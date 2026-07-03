import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, PhilippinePeso, Activity, Users, Box, Flag } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { PageSkeleton } from '../../components/ui/PageSkeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useTeams } from '../../hooks/useTeams';

const Sales: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const { loading, data } = useDashboardData(selectedTeam);
  const [selectedSalesmanVd30, setSelectedSalesmanVd30] = useState<any>(null);

  if (loading && data.salesmen.length === 0) {
    return <PageSkeleton />;
  }

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>Sales Performance</h2>
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

      {/* Primary KPI row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '20px' 
      }}>
        <Card title="STT Target" value={formatCurrency(data.target)} icon={<Target size={20} />} />
        <Card title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            STT (Net Value)
            <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{data.target > 0 ? ((data.mtdSales / data.target) * 100).toFixed(1) + '%' : '0.0%'}</span>
          </span>
        } value={formatCurrency(data.mtdSales)} icon={<PhilippinePeso size={20} />} />
        <Card title="STT Balance" value={formatCurrency(data.balance)} icon={<Activity size={20} />} />
        <Card title="Volume" value={`${data.mtdVolume.toLocaleString(undefined, { maximumFractionDigits: 1 })} CS`} icon={<Box size={20} />} />
      </div>

      {/* Secondary KPI row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        <Card title="GSR" value={formatCurrency(data.gsr)} subtitle="Good Stock Returns (Est.)" />
        <Card title="BSR" value={formatCurrency(data.bsr)} subtitle="Bad Stock Returns (Est.)" />
        <Card title="Current CML" value={data.cml.toLocaleString()} icon={<Users size={20} />} subtitle="Customer Master List" />
        
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '14px', margin: 0, marginBottom: '16px' }}>Frequency</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-panel)', padding: '8px 4px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>F1</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{(data.frequency?.f1 || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-panel)', padding: '8px 4px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>F2</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{(data.frequency?.f2 || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-panel)', padding: '8px 4px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>F3</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{(data.frequency?.f3 || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-panel)', padding: '8px 4px', borderRadius: '4px', textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>F4</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{(data.frequency?.f4 || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* UBA Performance Section */}
      <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-main)' }}>UBA Performance</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '20px', 
        marginBottom: '32px' 
      }}>
        <Card title="UBA Target" value={data.ubaTarget.toLocaleString()} />
        <Card title="UBA Performance" value={data.uba.toLocaleString()} />
        <Card title="UBA Balance" value={Math.max(data.ubaTarget - data.uba, 0).toLocaleString()} />
      </div>

      {/* Breakdowns */}
      <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-main)' }}>Performance Chart</h3>
      <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
        
        {/* Geo Breakdown */}
        <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>
            Geo Performance {role === 'salesman' ? '(Barangay)' : '(City)'}
          </h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data.geo} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip 
                  formatter={(value: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'Value']}
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Breakdown */}
        <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>Customer Channel</h3>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data.channels}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <Tooltip 
                  formatter={(value: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), 'Value']}
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Salesman Performance Section */}
      <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-main)' }}>Salesman Performance</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', paddingBottom: '32px' }}>
        {data.salesmen.map(s => (
          <div key={s.id} className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {s.photoURL ? <img src={s.photoURL} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-muted)' }}>{s.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</h4>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.id}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  STT 
                  <Flag size={12} fill={s.mtdSales >= s.target && s.target > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'} color={s.mtdSales >= s.target && s.target > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'} />
                  <span style={{ fontSize: '11px', color: 'var(--text-main)' }}>{s.target > 0 ? ((s.mtdSales / s.target) * 100).toFixed(1) + '%' : '0.0%'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span>Actual:</span> <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{formatCurrency(s.mtdSales)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span>Target:</span> <span>{formatCurrency(s.target)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Balance:</span> <span>{formatCurrency(Math.max(s.target - s.mtdSales, 0))}</span></div>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  UBA
                  <Flag size={12} fill={s.uba >= s.ubaTarget && s.ubaTarget > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'} color={s.uba >= s.ubaTarget && s.ubaTarget > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'} />
                  <span style={{ fontSize: '11px', color: 'var(--text-main)' }}>{s.ubaTarget > 0 ? ((s.uba / s.ubaTarget) * 100).toFixed(1) + '%' : '0.0%'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span>Actual:</span> <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{s.uba.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span>Target:</span> <span>{s.ubaTarget.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span>Balance:</span> <span>{Math.max(s.ubaTarget - s.uba, 0).toLocaleString()}</span></div>
              </div>
            </div>

            <button onClick={() => setSelectedSalesmanVd30(s)} className="btn interactive" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
              View VD30 Performance
            </button>
          </div>
        ))}
        {data.salesmen.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', gridColumn: '1 / -1' }}>No salesmen data found for this team.</div>
        )}
      </div>

      <Modal isOpen={!!selectedSalesmanVd30} onClose={() => setSelectedSalesmanVd30(null)} title={`${selectedSalesmanVd30?.name || ''} - VD30`}>
        {selectedSalesmanVd30 && (
          <div style={{ height: `${Math.max(350, Object.keys(selectedSalesmanVd30.vd30TargetMap || {}).length * 30)}px`, width: '100%', minWidth: 0, marginTop: '8px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart layout="vertical" data={Object.keys(selectedSalesmanVd30.vd30TargetMap || {}).map(k => {
                const itemName = k.split('_')[0];
                return {
                  name: itemName,
                  description: data.vd30.find(v => v.name === itemName)?.description || '',
                  target: selectedSalesmanVd30.vd30TargetMap[k],
                  actual: selectedSalesmanVd30.vd30ActualMap[k] || 0
                };
              }).sort((a,b) => a.name.localeCompare(b.name))} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
                <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} width={30} />
                <Tooltip 
                  labelFormatter={(label, payload) => {
                    const desc = payload && payload.length > 0 ? payload[0].payload.description : '';
                    return desc ? `${label} - ${desc}` : label;
                  }}
                  formatter={(value: any, name: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), String(name)]}
                  contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Bar name="Target" dataKey="target" fill="rgba(255,255,255,0.2)" radius={[0, 4, 4, 0]} />
                <Bar name="Actual" dataKey="actual" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sales;
