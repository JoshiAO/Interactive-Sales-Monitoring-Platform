import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIncentiveDashboard } from '../../hooks/useIncentiveDashboard';
import { useTeams } from '../../hooks/useTeams';
import { ArrowLeft, Trophy, CheckCircle, Circle, AlertCircle, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSXStyle from 'xlsx-js-style';

const IncentiveDetails: React.FC = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  
  const { loading, program, dashboardData } = useIncentiveDashboard(programId);

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>Loading Incentive Dashboard...</div>;
  if (!program) return <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>Program not found.</div>;

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const renderProgressBar = (actual: number, target: number) => {
    const pct = target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 100 : 0);
    const isHit = target > 0 && actual >= target;
    return (
      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: isHit ? 'var(--accent-success)' : 'var(--accent-primary)', transition: 'width 0.5s ease' }} />
      </div>
    );
  };

  const filteredSalesmen = dashboardData?.salesmen?.filter((s: any) => selectedTeam === 'all' || s.team === selectedTeam) || [];

  const canExport = role === 'admin' || role === 'manager' || role === 'supervisor';

  const handleExport = () => {
    if (!filteredSalesmen.length) return;

    const groupKeys = Object.keys(program.trackingGroups || {});
    
    // --- Define Styles ---
    const headerStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "F3F4F6" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };

    const cellStyle = {
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
      }
    };
    
    const numStyle = { ...cellStyle, alignment: { horizontal: "right", vertical: "center" } };
    const pctStyle = { ...cellStyle, alignment: { horizontal: "right", vertical: "center" } };

    // --- Build Structure ---
    const headerRow1 = [
      { v: 'Salesman Code', t: 's', s: headerStyle },
      { v: 'Salesman Name', t: 's', s: headerStyle },
      { v: 'Team', t: 's', s: headerStyle }
    ];
    const headerRow2 = [
      { v: '', t: 's', s: headerStyle },
      { v: '', t: 's', s: headerStyle },
      { v: '', t: 's', s: headerStyle }
    ];

    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }
    ];

    let currentCol = 3;
    groupKeys.forEach(groupId => {
      const groupDef = program.trackingGroups[groupId];
      
      // Top row spans 4 cols
      headerRow1.push({ v: groupDef.name, t: 's', s: headerStyle });
      headerRow1.push({ v: '', t: 's', s: headerStyle });
      headerRow1.push({ v: '', t: 's', s: headerStyle });
      headerRow1.push({ v: '', t: 's', s: headerStyle });
      
      // Second row sub-headers
      headerRow2.push({ v: 'Target', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Actual', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Balance', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Index (%)', t: 's', s: headerStyle });
      
      merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + 3 } });
      currentCol += 4;
    });

    const aoa: any[][] = [headerRow1, headerRow2];
    const groupTotals: Record<string, { target: number, actual: number, balance: number }> = {};
    groupKeys.forEach(g => groupTotals[g] = { target: 0, actual: 0, balance: 0 });

    filteredSalesmen.forEach((s: any) => {
      const row: any[] = [
        { v: s.id, t: 's', s: cellStyle },
        { v: s.name, t: 's', s: cellStyle },
        { v: s.team || '-', t: 's', s: cellStyle }
      ];
      
      groupKeys.forEach(groupId => {
        const groupDef = program.trackingGroups[groupId];
        const res = s.trackingResults?.[groupId] || { targetValue: 0, actualSTT: 0, actualUBA: 0 };
        const actual = groupDef.targetType === 'STT' ? res.actualSTT : res.actualUBA;
        const target = res.targetValue || 0;
        const balance = Math.max(0, target - actual);
        const indexFraction = target > 0 ? (actual / target) : (actual > 0 ? 1 : 0);
        
        groupTotals[groupId].target += target;
        groupTotals[groupId].actual += actual;
        groupTotals[groupId].balance += balance;

        row.push({ v: target, t: 'n', s: numStyle });
        row.push({ v: actual, t: 'n', s: numStyle });
        row.push({ v: balance, t: 'n', s: numStyle });
        row.push({ v: indexFraction, t: 'n', s: pctStyle, z: '0.00%' });
      });
      aoa.push(row);
    });

    const totalNumStyle = { ...headerStyle, alignment: { horizontal: "right", vertical: "center" } };
    const totalPctStyle = { ...headerStyle, alignment: { horizontal: "right", vertical: "center" } };

    const totalRow: any[] = [
      { v: 'TOTAL', t: 's', s: headerStyle },
      { v: '', t: 's', s: headerStyle },
      { v: '', t: 's', s: headerStyle }
    ];
    merges.push({ s: { r: aoa.length, c: 0 }, e: { r: aoa.length, c: 2 } });

    groupKeys.forEach(groupId => {
      const t = groupTotals[groupId];
      const indexFraction = t.target > 0 ? (t.actual / t.target) : (t.actual > 0 ? 1 : 0);
      totalRow.push({ v: t.target, t: 'n', s: totalNumStyle });
      totalRow.push({ v: t.actual, t: 'n', s: totalNumStyle });
      totalRow.push({ v: t.balance, t: 'n', s: totalNumStyle });
      totalRow.push({ v: indexFraction, t: 'n', s: totalPctStyle, z: '0.00%' });
    });
    aoa.push(totalRow);

    const ws = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    
    // Auto column widths
    const colWidths = [{ wch: 15 }, { wch: 25 }, { wch: 12 }];
    for (let i = 3; i < headerRow1.length; i++) colWidths.push({ wch: 12 });
    ws['!cols'] = colWidths;

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "Incentive Report");
    
    const programNameSafe = (program.title || program.id || 'Program').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSXStyle.writeFile(wb, `Incentive_${programNameSafe}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div style={{ paddingBottom: '40px' }} className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/incentives')} 
          style={{ 
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            marginLeft: '-12px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            transform: 'translateX(0)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--text-main)';
            e.currentTarget.style.transform = 'translateX(-4px)';
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderRadius = '8px';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <ArrowLeft size={18} /> Back to Incentives
        </button>

        {canExport && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '6px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={handleExport} 
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }} 
              title="Export to Excel"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ 
        position: 'relative', 
        overflow: 'hidden', 
        marginBottom: '24px',
        display: 'flex',
        minHeight: '200px'
      }}>
        {program.bannerUrl && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '70%',
              height: '100%',
              backgroundImage: `url(${program.bannerUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'left center', // to ensure we see the left part fading nicely
            }} />
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(to right, rgba(15,23,42,1) 30%, rgba(15,23,42,1) 40%, rgba(15,23,42,0) 100%)',
            }} />
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 2, padding: '32px', width: program.bannerUrl ? '65%' : '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '32px', color: 'var(--text-main)', margin: '0 0 12px 0' }}>{program.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', margin: '0 0 24px 0', lineHeight: 1.6, maxWidth: '800px' }}>{program.description}</p>
          <div style={{ display: 'flex', gap: '12px' }}>
             <span style={{ fontSize: '13px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600 }}>
               {program.startMonth} to {program.endMonth}
             </span>
             <span style={{ fontSize: '13px', background: program.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.1)', color: program.status === 'active' ? '#4ade80' : 'var(--text-muted)', padding: '6px 16px', borderRadius: '20px', border: '1px solid', borderColor: program.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.2)', fontWeight: 600 }}>
               {program.status.toUpperCase()}
             </span>
          </div>
        </div>
      </div>

      {filteredSalesmen.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {(() => {
            const groupKeys = Object.keys(program.trackingGroups || {});
            
            if (groupKeys.length >= 2) {
              // Render Bar Chart for multiple tracking groups
              const chartData = groupKeys.map(groupId => {
                const groupDef = program.trackingGroups[groupId];
                let target = 0;
                let actual = 0;
                filteredSalesmen.forEach((s: any) => {
                  if (s.trackingResults && s.trackingResults[groupId]) {
                    target += s.trackingResults[groupId].targetValue || 0;
                    actual += (groupDef.targetType === 'STT' ? (s.trackingResults[groupId].actualSTT || 0) : (s.trackingResults[groupId].actualUBA || 0));
                  }
                });
                return {
                  name: groupDef.name,
                  Target: target,
                  Actual: actual,
                  type: groupDef.targetType
                };
              });

              return (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 24px 0', color: 'var(--text-main)', fontSize: '18px', fontWeight: 600 }}>Performance by Tracking Group</h3>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                        <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 500 }}
                          formatter={(val: any, name: any, props: any) => {
                            const type = props.payload.type;
                            const formatted = type === 'STT' || type === 'Mixed' ? formatCurrency(Number(val)) : Number(val).toLocaleString();
                            return [formatted, name];
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="Target" fill="rgba(255, 255, 255, 0.2)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                        <Bar dataKey="Actual" fill="var(--accent-primary)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            } else {
              // Render 3 Metric Cards for single tracking group
              let globalTarget = 0;
              let globalActual = 0;
              let targetType = 'STT';
              let typeFound = '';
              let isMixed = false;
              
              filteredSalesmen.forEach((s: any) => {
                Object.values(s.trackingResults).forEach((res: any) => {
                  globalTarget += res.targetValue;
                  globalActual += res.targetType === 'STT' ? res.actualSTT : res.actualUBA;
                  if (!typeFound) typeFound = res.targetType;
                  else if (typeFound !== res.targetType) isMixed = true;
                });
              });
              targetType = isMixed ? 'Mixed' : (typeFound || 'STT');
              
              const formatMetric = (val: number) => targetType === 'STT' || targetType === 'Mixed' ? formatCurrency(val) : val.toLocaleString();
              const globalBalance = Math.max(0, globalTarget - globalActual);
              const globalPct = globalTarget > 0 ? Math.min((globalActual / globalTarget) * 100, 100).toFixed(1) : (globalActual > 0 ? 100 : 0).toFixed(1);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Target (Current Month)</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'white' }}>{formatMetric(globalTarget)}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatMetric(globalActual)}</div>
                      <div style={{ fontSize: '14px', color: '#4ade80', fontWeight: 600, marginBottom: '6px' }}>{globalPct}%</div>
                    </div>
                  </div>
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-warning)' }}>{formatMetric(globalBalance)}</div>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        {(role === 'manager' || role === 'admin') && availableTeams.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '8px' }}>Team:</span>
            {availableTeams.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTeam(t)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: selectedTeam === t ? 'var(--accent-primary)' : 'var(--border)',
                  backgroundColor: selectedTeam === t ? 'var(--accent-primary)' : 'rgba(0,0,0,0.2)',
                  color: selectedTeam === t ? '#fff' : 'var(--text-muted)',
                  fontSize: '13px',
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
                  padding: '6px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--accent-danger)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginLeft: '4px'
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {!dashboardData || filteredSalesmen.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3>No Performance Data Available</h3>
          <p>This program either has no participating salesmen in the selected team, or no data has been aggregated yet.<br/>Ensure "Net Invoiced" data is uploaded while this program is active.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
           {/* Detailed Salesman Cards */}
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
             {filteredSalesmen.map((s: any) => (
                <div key={s.id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', opacity: s.isAllowed ? 1 : 0.6 }}>
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {s.photoURL ? <img src={s.photoURL} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-muted)' }}>{s.name.charAt(0)}</span>}
                         </div>
                         <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'white' }}>{s.name}</h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.id} • {s.team}</div>
                         </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '16px' }}>
                         <Trophy size={14} color="var(--accent-warning)" />
                         <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{s.targetsHit} / {s.totalTargets}</span>
                      </div>
                   </div>

                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {Object.values(s.trackingResults).map((res: any) => (
                         <div key={res.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', border: res.isHit ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {res.isHit ? <CheckCircle size={14} color="#4ade80" /> : <Circle size={14} color="var(--text-muted)" />}
                                  <span style={{ fontSize: '14px', color: res.isHit ? 'white' : 'var(--text-muted)', fontWeight: res.isHit ? 600 : 400 }}>{res.name}</span>
                               </div>
                               <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  {res.targetType === 'STT' ? formatCurrency(res.actualSTT) : `${res.actualUBA} UBA`} 
                                  {' '} / {' '} 
                                  {res.targetType === 'STT' ? formatCurrency(res.targetValue) : res.targetValue}
                               </span>
                            </div>
                            {renderProgressBar(res.targetType === 'STT' ? res.actualSTT : res.actualUBA, res.targetValue)}
                         </div>
                      ))}
                   </div>
                </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default IncentiveDetails;
