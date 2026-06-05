import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useTeams } from '../../hooks/useTeams';
import { Loader2 } from 'lucide-react';

const Meter: React.FC<{ target: number; actual: number }> = ({ target, actual }) => {
  const percent = Math.min((actual / (target || 1)) * 100, 100).toFixed(0);
  const color = actual >= target ? 'var(--accent-success)' : 'var(--accent-primary)';
  
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Achieved: {percent}%</span>
        <span>{actual} / {target}</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

const VD30: React.FC = () => {
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  const { loading, data } = useDashboardData(selectedTeam);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '50vh', color: 'var(--accent-primary)' }}>
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  const displayItems = data.vd30.filter(item => item.target > 0);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h2>VD30 Performance</h2>
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

      {/* Aggregate Bar Chart */}
      <div className="glass-panel" style={{ height: '350px', marginBottom: '32px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>Overall VD30 Achievement</h3>
        <div style={{ flex: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayItems} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
              <Tooltip 
                formatter={(value: any, name: any) => [Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 }), String(name)]}
                contentStyle={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--text-main)' }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar name="Target" dataKey="target" fill="rgba(255,255,255,0.2)" radius={[4, 4, 0, 0]} />
              <Bar name="Actual" dataKey="actual" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Itemized Cards Grid */}
      <h3 style={{ marginBottom: '16px', fontSize: '18px', color: 'var(--text-main)' }}>Itemized Performance (Top 30 Core)</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
        gap: '16px' 
      }}>
        {displayItems.map(item => (
          <div key={item.code} className="glass-panel interactive" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setSelectedItem(item)}>
            <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '15px' }}>{item.code}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', minHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.description || 'No Description'}
            </div>
            <Meter target={item.target} actual={item.actual} />
          </div>
        ))}
        {displayItems.length === 0 && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>
            No VD30 data available.
          </div>
        )}
      </div>

      <Modal 
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || ''}
      >
        {selectedItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontWeight: '500', color: 'var(--accent-primary)', fontSize: '18px' }}>
              {selectedItem.description}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target Placements</span>
              <span style={{ fontWeight: 'bold' }}>{selectedItem.target} Stores</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Actual Placements</span>
              <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{selectedItem.actual} Stores</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Index</span>
              <span style={{ fontWeight: 'bold', color: selectedItem.actual >= selectedItem.target ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                {((selectedItem.actual / (selectedItem.target || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VD30;
