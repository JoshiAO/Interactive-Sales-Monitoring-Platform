import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { exportMcp } from '../../utils/exportMcp';
import { useAuth } from '../../contexts/AuthContext';

interface MasterCoveragePlanTableProps {
  salesman: any;
  customers: any[];
  selectedDay: string;
  selectedWeek: string;
  onDayChange: (day: string) => void;
  onWeekChange: (week: string) => void;
  onBack?: () => void;
}

const MasterCoveragePlanTable: React.FC<MasterCoveragePlanTableProps> = ({ 
  salesman, 
  customers, 
  selectedDay, 
  selectedWeek,
  onDayChange,
  onWeekChange,
  onBack
}) => {
  const { role } = useAuth();
  
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (c.salesmanId !== salesman.id) return false;
      const cDay = c.coverageDay || '';
      if (!cDay) return false;
      
      const dayTarget = selectedDay.toUpperCase();
      const isDayMatch = cDay === dayTarget || dayTarget.startsWith(cDay.substring(0, 3)) || cDay.includes(dayTarget);
      if (!isDayMatch) return false;

      const cWeek = c.wklyCoverage || '';
      const isW1W3 = (cWeek.includes('1') && cWeek.includes('3')) || cWeek.includes('W1&W3');
      const isW2W4 = (cWeek.includes('2') && cWeek.includes('4')) || cWeek.includes('W2&W4');
      const isWkly = cWeek.includes('WKLY') || cWeek.includes('WEEKLY') || cWeek === 'W' || cWeek === 'WEEK';
      
      if (selectedWeek === 'W1&W3') {
        return isW1W3 || isWkly;
      } else if (selectedWeek === 'W2&W4') {
        return isW2W4 || isWkly;
      } else if (selectedWeek === 'WKLY') {
        return isWkly;
      }
      
      return true;
    });
  }, [customers, salesman.id, selectedDay, selectedWeek]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeks = [
    { id: 'W1&W3', label: 'Week 1 & 3' },
    { id: 'W2&W4', label: 'Week 2 & 4' },
    { id: 'WKLY', label: 'Weekly' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      {/* Header & Slicers */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              {onBack && (
                <button onClick={onBack} className="btn" style={{ padding: '6px 12px', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-main)', fontSize: '13px', cursor: 'pointer' }}>
                  &larr; Back
                </button>
              )}
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>Master Coverage Plan</h1>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '16px', rowGap: '8px', fontSize: '14px' }}>
              <div style={{ color: 'var(--text-muted)' }}>Salesman Name:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{salesman.name}</div>
              
              <div style={{ color: 'var(--text-muted)' }}>Salesman Code:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{salesman.id}</div>
              
              <div style={{ color: 'var(--text-muted)' }}>Service Model:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{salesman.type}</div>
              
              <div style={{ color: 'var(--text-muted)' }}>Supervisor Name:</div>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{salesman.supervisor}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Coverage Day</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '300px' }}>
                {days.map(day => (
                  <button
                    key={day}
                    onClick={() => onDayChange(day)}
                    className={`btn ${selectedDay === day ? 'btn-primary' : ''}`}
                    style={{ 
                      background: selectedDay === day ? 'var(--accent-primary)' : 'var(--bg-dark)',
                      color: selectedDay === day ? 'white' : 'var(--text-main)',
                      border: `1px solid ${selectedDay === day ? 'var(--accent-primary)' : 'var(--border)'}`,
                      padding: '6px 12px',
                      fontSize: '13px'
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Weekly Coverage</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {weeks.map(w => (
                  <button
                    key={w.id}
                    onClick={() => onWeekChange(w.id)}
                    className={`btn ${selectedWeek === w.id ? 'btn-primary' : ''}`}
                    style={{ 
                      background: selectedWeek === w.id ? 'var(--accent-primary)' : 'var(--bg-dark)',
                      color: selectedWeek === w.id ? 'white' : 'var(--text-main)',
                      border: `1px solid ${selectedWeek === w.id ? 'var(--accent-primary)' : 'var(--border)'}`,
                      padding: '6px 12px',
                      fontSize: '13px'
                    }}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-end', marginTop: 'auto' }}>
                {(role === 'admin' || role === 'manager' || role === 'supervisor') && (
                  <button 
                    onClick={() => exportMcp([salesman], customers, `MCP_${salesman.id}`)}
                    className="btn btn-outline" 
                    style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '4px', background: 'var(--bg-dark)', color: 'var(--text-main)', border: '1px solid var(--border)', cursor: 'pointer' }}
                    title="Export MCP to Excel"
                  >
                    <Download size={14} /> Export
                  </button>
                )}
                <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '4px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  Planned: {filteredCustomers.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: 'var(--bg-dark)' }}>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', width: '50px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Seq</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', width: '120px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Account Code</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Account Name</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', width: '120px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>CustClass</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', width: '150px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Barangay</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'left', width: '150px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>Town/City</th>
                
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', width: '50px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, background: selectedWeek.includes('W1') || selectedWeek === 'WKLY' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)' }}>Wk1</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', width: '50px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, background: selectedWeek.includes('W2') || selectedWeek === 'WKLY' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)' }}>Wk2</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', textAlign: 'center', width: '50px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, background: selectedWeek.includes('W3') || selectedWeek === 'WKLY' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)' }}>Wk3</th>
                <th style={{ padding: '12px', borderBottom: '2px solid var(--border)', textAlign: 'center', width: '50px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, background: selectedWeek.includes('W4') || selectedWeek === 'WKLY' ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-dark)' }}>Wk4</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No customers found for {selectedDay} ({weeks.find(w => w.id === selectedWeek)?.label}).
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, index) => {
                  const isWk1 = selectedWeek.includes('W1') || selectedWeek === 'WKLY';
                  const isWk2 = selectedWeek.includes('W2') || selectedWeek === 'WKLY';
                  const isWk3 = selectedWeek.includes('W3') || selectedWeek === 'WKLY';
                  const isWk4 = selectedWeek.includes('W4') || selectedWeek === 'WKLY';
                  
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', '&:hover': { background: 'var(--bg-panel-hover)' } } as any}>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{index + 1}</td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '13px', fontFamily: 'monospace' }}>{c.id}</td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={c.customerClass}>{c.customerClass}</td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>{c.barangay}</td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>{c.city}</td>
                      
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', textAlign: 'center', background: isWk1 ? 'transparent' : 'rgba(0,0,0,0.2)' }}>
                        {isWk1 ? <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>1</span> : null}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', textAlign: 'center', background: isWk2 ? 'transparent' : 'rgba(0,0,0,0.2)' }}>
                        {isWk2 ? <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>1</span> : null}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid var(--border)', textAlign: 'center', background: isWk3 ? 'transparent' : 'rgba(0,0,0,0.2)' }}>
                        {isWk3 ? <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>1</span> : null}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', background: isWk4 ? 'transparent' : 'rgba(0,0,0,0.2)' }}>
                        {isWk4 ? <span style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>1</span> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MasterCoveragePlanTable;
