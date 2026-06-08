import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Medal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesmanPerformanceModalProps {
  salesman: any;
  rawAchievements?: Record<string, any>;
  onClose: () => void;
}

const SalesmanPerformanceModal: React.FC<SalesmanPerformanceModalProps> = ({ salesman, rawAchievements, onClose }) => {
  // Extract unique dates from rawAchievements
  const dates = useMemo(() => {
    if (!rawAchievements) return [];
    return Object.keys(rawAchievements).sort();
  }, [rawAchievements]);

  // Build Table Data
  const getMedalIcon = (medal: string) => {
    if (medal === 'gold') return <Medal size={16} fill="#FBBF24" color="#78350f" />;
    if (medal === 'silver') return <Medal size={16} fill="#9CA3AF" color="#1f2937" />;
    if (medal === 'bronze') return <Medal size={16} fill="#B45309" color="#451a03" />;
    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  };

  // Build Graph Data
  const graphData = useMemo(() => {
    if (!rawAchievements) return [];
    return dates.map(date => {
      const dayData = rawAchievements[date][salesman.id];
      if (!dayData || !dayData.metrics) {
        return { date, STT: 0, UBA: 0, VD30: 0 };
      }
      return {
        date,
        STT: dayData.metrics.stt?.index || 0,
        UBA: dayData.metrics.uba?.index || 0,
        VD30: dayData.metrics.vd30?.index || 0,
      };
    });
  }, [rawAchievements, dates, salesman.id]);

  const metrics = [
    { key: 'stt', label: 'STT Index' },
    { key: 'uba', label: 'UBA Index' },
    { key: 'vd30', label: 'VD30 Index' }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color, fontSize: '12px' }}>
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return createPortal(
    <div className="animate-fade-in-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '800px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: '16px', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             {salesman.photoURL ? (
                <img src={salesman.photoURL} alt={salesman.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '24px' }}>
                  {salesman.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{salesman.name}</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{salesman.id} • {salesman.type}</div>
              </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Medal History</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Medal size={14} fill="#FBBF24" color="#78350f" /> Gold (5 pts)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Medal size={14} fill="#9CA3AF" color="#1f2937" /> Silver (3 pts)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Medal size={14} fill="#B45309" color="#451a03" /> Bronze (1 pt)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px', color: 'var(--text-main)', fontWeight: 'bold', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                Total Points: <span style={{ color: 'var(--accent-primary)', fontSize: '14px' }}>{salesman.achievements?.points || 0}</span>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: '32px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg-panel)', padding: '12px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'left', zIndex: 2 }}>Metric</th>
                  {dates.map(date => (
                    <th key={date} style={{ padding: '12px', borderBottom: '1px solid var(--border)', minWidth: '100px' }}>{date.split('-').slice(1).join('-')}</th>
                  ))}
                  {dates.length === 0 && <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>No Data</th>}
                </tr>
              </thead>
              <tbody>
                {metrics.map(metric => (
                  <tr key={metric.key}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-panel)', padding: '12px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 600, zIndex: 1 }}>
                      {metric.label}
                    </td>
                    {dates.map(date => {
                      const dayData = rawAchievements?.[date]?.[salesman.id];
                      const medal = dayData?.metrics?.[metric.key]?.medal || 'none';
                      return (
                        <td key={date} style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                          {getMedalIcon(medal)}
                        </td>
                      );
                    })}
                    {dates.length === 0 && <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>-</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Graph Section */}
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Daily Performance Trend</h3>
          
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-muted)' }}>STT Index (%)</h4>
            <div style={{ height: '200px', width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ minWidth: dates.length > 7 ? `${dates.length * 80}px` : '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.split('-').slice(1).join('-')} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="STT" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-muted)' }}>UBA Index (%)</h4>
            <div style={{ height: '200px', width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ minWidth: dates.length > 7 ? `${dates.length * 80}px` : '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.split('-').slice(1).join('-')} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="UBA" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-muted)' }}>VD30 Index (%)</h4>
            <div style={{ height: '200px', width: '100%', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ minWidth: dates.length > 7 ? `${dates.length * 80}px` : '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => val.split('-').slice(1).join('-')} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="VD30" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4, fill: '#F59E0B' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default SalesmanPerformanceModal;
