import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useIncentiveDashboard } from '../../hooks/useIncentiveDashboard';
import { useTeams } from '../../hooks/useTeams';
import { ArrowLeft, Trophy, CheckCircle, Circle, AlertCircle, Download, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import * as XLSXStyle from 'xlsx-js-style';
import { getCropCss } from '../../utils/cropUtils';

const IncentiveDetails: React.FC = () => {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const availableTeams = useTeams();
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [activeCardTabs, setActiveCardTabs] = useState<Record<string, string>>({});
  
  const { loading, program, dashboardData } = useIncentiveDashboard(programId);

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>Loading Incentive Dashboard...</div>;
  if (!program) return <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>Program not found.</div>;

  const formatCurrency = (val: number) => `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const sortedTrackingGroups: any[] = Object.values(program.trackingGroups || {}).sort((a: any, b: any) => {
    const timeA = a.createdAt || Number((a.id || '').replace(/[^0-9]/g, '')) || 0;
    const timeB = b.createdAt || Number((b.id || '').replace(/[^0-9]/g, '')) || 0;
    return timeA - timeB;
  });

  const renderProgressBar = (actual: number, target: number) => {
    const pct = target > 0 ? Math.min((actual / target) * 100, 100) : (actual > 0 ? 100 : 0);
    const isHit = target > 0 && actual >= target;
    return (
      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: isHit ? 'var(--accent-success)' : 'var(--accent-primary)', transition: 'width 0.5s ease' }} />
      </div>
    );
  };  const getGroupActual = (res: any) => {
    if (!res) return 0;
    const tType = res.definitionType === 'new_customer' ? 'UBA' : (res.targetType || 'STT');
    if (tType === 'STT') return res.actualSTT || 0;
    if (res.subGroupsList && res.subGroupsList.length > 0) {
      return res.subGroupsList.reduce((acc: number, sub: any) => acc + (sub.actualUBA || 0), 0);
    }
    return res.actualUBA || 0;
  };

  const filteredSalesmen = dashboardData?.salesmen?.filter((s: any) => selectedTeam === 'all' || s.team === selectedTeam) || [];

  const canExport = role === 'admin' || role === 'manager' || role === 'supervisor';

  const handleExport = () => {
    if (!filteredSalesmen.length) return;

    const groupKeys = sortedTrackingGroups.map((g: any) => g.id);
    
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

    // --- Build Structure for Main Summary Sheet ---
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
    
    // Extract all unique dates for daily breakdown if enabled
    const allDates = new Set<string>();
    filteredSalesmen.forEach((s: any) => {
      Object.keys(s.trackingResults || {}).forEach(groupId => {
        const res = s.trackingResults[groupId];
        if (res.enableDailyBreakdown && res.daily) {
          Object.keys(res.daily).forEach(d => allDates.add(d));
        }
      });
    });
    const sortedDates = Array.from(allDates).sort();

    groupKeys.forEach(groupId => {
      const groupDef = program.trackingGroups[groupId];
      
      let colsForGroup = 4; // Target, Actual, Balance, Index
      if (groupDef?.enableDailyBreakdown) {
         colsForGroup += sortedDates.length * 2; // Daily STT and Daily UBA
      }
      
      // Top row spans `colsForGroup` cols
      headerRow1.push({ v: groupDef?.name || groupId, t: 's', s: headerStyle });
      for (let i = 1; i < colsForGroup; i++) {
        headerRow1.push({ v: '', t: 's', s: headerStyle });
      }
      
      // Second row sub-headers
      headerRow2.push({ v: 'Target', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Actual', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Balance', t: 's', s: headerStyle });
      headerRow2.push({ v: 'Index (%)', t: 's', s: headerStyle });
      
      if (groupDef?.enableDailyBreakdown) {
         sortedDates.forEach(d => {
            headerRow2.push({ v: `${d} (STT)`, t: 's', s: headerStyle });
            headerRow2.push({ v: `${d} (UBA)`, t: 's', s: headerStyle });
         });
      }
      
      merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + colsForGroup - 1 } });
      currentCol += colsForGroup;
    });

    const aoa: any[][] = [headerRow1, headerRow2];
    const groupTotals: Record<string, { target: number, actual: number, balance: number, daily: Record<string, {stt: number, uba: number}> }> = {};
    groupKeys.forEach(g => {
       groupTotals[g] = { target: 0, actual: 0, balance: 0, daily: {} };
       if (program.trackingGroups[g]?.enableDailyBreakdown) {
          sortedDates.forEach(d => {
             groupTotals[g].daily[d] = { stt: 0, uba: 0 };
          });
       }
    });

    filteredSalesmen.forEach((s: any) => {
      const row: any[] = [
        { v: s.id, t: 's', s: cellStyle },
        { v: s.name, t: 's', s: cellStyle },
        { v: s.team || '-', t: 's', s: cellStyle }
      ];
      
      groupKeys.forEach(groupId => {
        const groupDef = program.trackingGroups[groupId];
        const res = s.trackingResults?.[groupId] || { targetValue: 0, actualSTT: 0, actualUBA: 0 };
        const actual = getGroupActual(res);
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
        
        if (groupDef?.enableDailyBreakdown) {
           sortedDates.forEach(d => {
              const dailyStt = res.daily?.[d]?.stt || 0;
              const dailyUba = res.daily?.[d]?.uba || 0;
              
              groupTotals[groupId].daily[d].stt += dailyStt;
              groupTotals[groupId].daily[d].uba += dailyUba;
              
              row.push({ v: dailyStt, t: 'n', s: numStyle });
              row.push({ v: dailyUba, t: 'n', s: numStyle });
           });
        }
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
      const groupDef = program.trackingGroups[groupId];
      const t = groupTotals[groupId];
      const indexFraction = t.target > 0 ? (t.actual / t.target) : (t.actual > 0 ? 1 : 0);
      totalRow.push({ v: t.target, t: 'n', s: totalNumStyle });
      totalRow.push({ v: t.actual, t: 'n', s: totalNumStyle });
      totalRow.push({ v: t.balance, t: 'n', s: totalNumStyle });
      totalRow.push({ v: indexFraction, t: 'n', s: totalPctStyle, z: '0.00%' });
      
      if (groupDef?.enableDailyBreakdown) {
         sortedDates.forEach(d => {
            totalRow.push({ v: t.daily[d].stt, t: 'n', s: totalNumStyle });
            totalRow.push({ v: t.daily[d].uba, t: 'n', s: totalNumStyle });
         });
      }
    });
    aoa.push(totalRow);

    const wsSummary = XLSXStyle.utils.aoa_to_sheet(aoa);
    wsSummary['!merges'] = merges;
    
    // Auto column widths
    const colWidths = [{ wch: 15 }, { wch: 25 }, { wch: 12 }];
    for (let i = 3; i < headerRow1.length; i++) colWidths.push({ wch: 12 });
    wsSummary['!cols'] = colWidths;

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, wsSummary, "Incentive Summary");

    // --- Build Dedicated Worksheets per Tracking Group with Sub-Product Groups ---
    const existingSheetNames = new Set<string>(['incentive summary']);

    sortedTrackingGroups.forEach((groupDef: any) => {
      const groupId = groupDef.id;
      const groupSubGroupsMap = new Map<string, { id: string; name: string }>();

      // Collect sub-groups from configuration
      if (groupDef?.subGroups) {
        const sgList = Array.isArray(groupDef.subGroups) ? groupDef.subGroups : Object.values(groupDef.subGroups);
        sgList.forEach((sg: any) => {
          if (sg && (sg.id || sg.name)) {
            groupSubGroupsMap.set(sg.id || sg.name, { id: sg.id || sg.name, name: sg.name || sg.id });
          }
        });
      }

      // Collect sub-groups from actual results
      filteredSalesmen.forEach((s: any) => {
        const res = s.trackingResults?.[groupId];
        if (res?.subGroupsList) {
          res.subGroupsList.forEach((sub: any) => {
            if (sub && (sub.id || sub.name) && !groupSubGroupsMap.has(sub.id)) {
              groupSubGroupsMap.set(sub.id, { id: sub.id, name: sub.name || sub.id });
            }
          });
        }
      });

      const subGroupList = Array.from(groupSubGroupsMap.values());
      
      // Only generate dedicated sheet if tracking group has Sub-Product Groups
      if (subGroupList.length > 0) {
        let cleanName = (groupDef.name || groupId).replace(/[:\\/?*\[\]]/g, '').trim();
        if (cleanName.length > 25) cleanName = cleanName.substring(0, 25).trim();
        if (!cleanName) cleanName = 'Group';
        
        let sheetName = cleanName;
        let counter = 1;
        while (existingSheetNames.has(sheetName.toLowerCase())) {
          sheetName = `${cleanName} (${counter})`;
          counter++;
        }
        existingSheetNames.add(sheetName.toLowerCase());

        // Header Row 1 & 2 for Group Sheet
        const gHeaderRow1: any[] = [
          { v: 'Salesman Code', t: 's', s: headerStyle },
          { v: 'Salesman Name', t: 's', s: headerStyle },
          { v: 'Team', t: 's', s: headerStyle },
          { v: 'Overall Target', t: 's', s: headerStyle },
          { v: 'Overall Actual', t: 's', s: headerStyle },
          { v: 'Overall Balance', t: 's', s: headerStyle },
          { v: 'Overall Index (%)', t: 's', s: headerStyle }
        ];

        const gHeaderRow2: any[] = [
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle }
        ];

        const gMerges: any[] = [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
          { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
          { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
          { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
          { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
          { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
          { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }
        ];

        let gCurrentCol = 7;
        subGroupList.forEach((subGroup) => {
          gHeaderRow1.push({ v: subGroup.name, t: 's', s: headerStyle });
          gHeaderRow1.push({ v: '', t: 's', s: headerStyle });
          gHeaderRow1.push({ v: '', t: 's', s: headerStyle });
          gHeaderRow1.push({ v: '', t: 's', s: headerStyle });

          gHeaderRow2.push({ v: 'Target', t: 's', s: headerStyle });
          gHeaderRow2.push({ v: 'Actual', t: 's', s: headerStyle });
          gHeaderRow2.push({ v: 'Balance', t: 's', s: headerStyle });
          gHeaderRow2.push({ v: 'Index (%)', t: 's', s: headerStyle });

          gMerges.push({ s: { r: 0, c: gCurrentCol }, e: { r: 0, c: gCurrentCol + 3 } });
          gCurrentCol += 4;
        });

        const gAoa: any[][] = [gHeaderRow1, gHeaderRow2];

        const subTotals: Record<string, { target: number; actual: number; balance: number }> = {};
        subGroupList.forEach((sg) => {
          subTotals[sg.id] = { target: 0, actual: 0, balance: 0 };
        });
        let gOverallTargetSum = 0;
        let gOverallActualSum = 0;
        let gOverallBalanceSum = 0;

        filteredSalesmen.forEach((s: any) => {
          const res = s.trackingResults?.[groupId] || { targetValue: 0, actualSTT: 0, actualUBA: 0 };
          const actual = getGroupActual(res);
          const target = res.targetValue || 0;
          const balance = Math.max(0, target - actual);
          const indexFraction = target > 0 ? actual / target : actual > 0 ? 1 : 0;
          const resTargetType = res.definitionType === 'new_customer' ? 'UBA' : res.targetType || groupDef.targetType || 'STT';

          gOverallTargetSum += target;
          gOverallActualSum += actual;
          gOverallBalanceSum += balance;

          const row: any[] = [
            { v: s.id, t: 's', s: cellStyle },
            { v: s.name, t: 's', s: cellStyle },
            { v: s.team || '-', t: 's', s: cellStyle },
            { v: target, t: 'n', s: numStyle },
            { v: actual, t: 'n', s: numStyle },
            { v: balance, t: 'n', s: numStyle },
            { v: indexFraction, t: 'n', s: pctStyle, z: '0.00%' }
          ];

          subGroupList.forEach((subGroup) => {
            const subRes = res.subGroupsList?.find((sub: any) => sub.id === subGroup.id);
            const subTarget = subRes?.targetValue || 0;
            const subActual = (resTargetType === 'STT' ? subRes?.actualSTT : subRes?.actualUBA) || 0;
            const subBalance = Math.max(0, subTarget - subActual);
            const subIndexFraction = subTarget > 0 ? subActual / subTarget : subActual > 0 ? 1 : 0;

            subTotals[subGroup.id].target += subTarget;
            subTotals[subGroup.id].actual += subActual;
            subTotals[subGroup.id].balance += subBalance;

            row.push({ v: subTarget, t: 'n', s: numStyle });
            row.push({ v: subActual, t: 'n', s: numStyle });
            row.push({ v: subBalance, t: 'n', s: numStyle });
            row.push({ v: subIndexFraction, t: 'n', s: pctStyle, z: '0.00%' });
          });

          gAoa.push(row);
        });

        // Group Total Row
        const gOverallIndexFraction = gOverallTargetSum > 0 ? gOverallActualSum / gOverallTargetSum : gOverallActualSum > 0 ? 1 : 0;
        const gTotalRow: any[] = [
          { v: 'TOTAL', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: '', t: 's', s: headerStyle },
          { v: gOverallTargetSum, t: 'n', s: totalNumStyle },
          { v: gOverallActualSum, t: 'n', s: totalNumStyle },
          { v: gOverallBalanceSum, t: 'n', s: totalNumStyle },
          { v: gOverallIndexFraction, t: 'n', s: totalPctStyle, z: '0.00%' }
        ];
        gMerges.push({ s: { r: gAoa.length, c: 0 }, e: { r: gAoa.length, c: 2 } });

        subGroupList.forEach((subGroup) => {
          const st = subTotals[subGroup.id];
          const subIndexFrac = st.target > 0 ? st.actual / st.target : st.actual > 0 ? 1 : 0;
          gTotalRow.push({ v: st.target, t: 'n', s: totalNumStyle });
          gTotalRow.push({ v: st.actual, t: 'n', s: totalNumStyle });
          gTotalRow.push({ v: st.balance, t: 'n', s: totalNumStyle });
          gTotalRow.push({ v: subIndexFrac, t: 'n', s: totalPctStyle, z: '0.00%' });
        });

        gAoa.push(gTotalRow);

        const wsGroup = XLSXStyle.utils.aoa_to_sheet(gAoa);
        wsGroup['!merges'] = gMerges;

        const gColWidths = [{ wch: 15 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
        for (let i = 7; i < gHeaderRow1.length; i++) gColWidths.push({ wch: 13 });
        wsGroup['!cols'] = gColWidths;

        XLSXStyle.utils.book_append_sheet(wb, wsGroup, sheetName);
      }
    });
    
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
              backgroundRepeat: 'no-repeat',
              ...(program.cropSettings?.banner ? getCropCss(program.cropSettings.banner) : { backgroundSize: 'cover', backgroundPosition: 'left center' }),
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
            const groupKeys = sortedTrackingGroups.map((g: any) => g.id);
            
            if (groupKeys.length >= 2) {
              // Render Bar Chart for tracking groups
              const chartData = sortedTrackingGroups.map((groupDef: any) => {
                let target = 0;
                let actual = 0;
                const groupTargetType = groupDef.definitionType === 'new_customer' ? 'UBA' : (groupDef.targetType || 'STT');

                filteredSalesmen.forEach((s: any) => {
                  if (s.trackingResults && s.trackingResults[groupDef.id]) {
                    const res = s.trackingResults[groupDef.id];
                    const sTarget = res.targetValue || 0;
                    const sActual = getGroupActual(res);
                    if (sTarget > 0 || sActual > 0) {
                      target += sTarget;
                      actual += sActual;
                    }
                  }
                });
                const indexPct = target > 0 ? (actual / target) * 100 : (actual > 0 ? 100 : 0);
                return {
                  name: groupDef.name,
                  'Target Benchmark': 100,
                  'Actual Index (%)': Number(indexPct.toFixed(1)),
                  targetRaw: target,
                  actualRaw: actual,
                  type: groupTargetType
                };
              });

              return (
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px', fontWeight: 600 }}>Performance by Tracking Group</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Achievement Index (% vs 100% Target Benchmark)</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                        <YAxis 
                          stroke="var(--text-muted)" 
                          tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                          axisLine={false} 
                          tickLine={false} 
                          domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 10) * 10)]}
                          tickFormatter={(val) => `${val}%`} 
                        />
                        <ReferenceLine y={100} stroke="rgba(34, 197, 94, 0.6)" strokeDasharray="4 4" label={{ value: '100% Target', fill: '#4ade80', fontSize: 11, position: 'top' }} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                          itemStyle={{ color: '#fff', fontWeight: 500 }}
                          formatter={(val: any, name: any, props: any) => {
                            const payload = props.payload;
                            const type = payload.type || 'STT';
                            const formattedRawActual = type === 'STT' ? formatCurrency(payload.actualRaw) : `${payload.actualRaw.toLocaleString()} UBA`;
                            const formattedRawTarget = type === 'STT' ? formatCurrency(payload.targetRaw) : `${payload.targetRaw.toLocaleString()} UBA`;
                            
                            if (name === 'Actual Index (%)') {
                              return [`${val}% (${formattedRawActual} / ${formattedRawTarget})`, 'Achievement Index'];
                            }
                            return [`${val}% (Target Benchmark)`, name];
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="Target Benchmark" fill="rgba(255, 255, 255, 0.12)" radius={[6, 6, 0, 0]} maxBarSize={50} />
                        <Bar dataKey="Actual Index (%)" fill="var(--accent-primary)" radius={[6, 6, 0, 0]} maxBarSize={50} />
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
                  const sTarget = res.targetValue || 0;
                  const sActual = getGroupActual(res);
                  if (sTarget > 0 || sActual > 0) {
                    globalTarget += sTarget;
                    globalActual += sActual;
                  }
                  const resTargetType = res.definitionType === 'new_customer' ? 'UBA' : (res.targetType || 'STT');
                  if (!typeFound) typeFound = resTargetType;
                  else if (typeFound !== resTargetType) isMixed = true;
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
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
             {filteredSalesmen.map((s: any) => {
                const subGroupTrackingGroups = sortedTrackingGroups.filter((g: any) => {
                  const res = s.trackingResults?.[g.id];
                  return (g.hasSubGroups && g.subGroups && Object.keys(g.subGroups).length > 0) || (res?.subGroupsList && res.subGroupsList.length > 0);
                });

                const activeTab = activeCardTabs[s.id] || 'summary';
                const hasSubGroupTabs = subGroupTrackingGroups.length > 0;
                const isGroupTabActive = hasSubGroupTabs && activeTab !== 'summary' && subGroupTrackingGroups.some((g: any) => g.id === activeTab);

                return (
                  <div key={s.id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', opacity: s.isAllowed ? 1 : 0.6 }}>
                     {/* Salesman Header */}
                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                           <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {s.photoURL ? <img src={s.photoURL} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-muted)' }}>{s.name.charAt(0)}</span>}
                           </div>
                           <div>
                              <h3 style={{ margin: 0, fontSize: '15px', color: 'white', fontWeight: 600 }}>{s.name}</h3>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.id} • {s.team}</div>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
                           <Trophy size={13} color="var(--accent-warning)" />
                           <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{s.targetsHit} / {s.totalTargets}</span>
                        </div>
                     </div>

                     {/* Horizontal Segmented Pill Tabs (Only rendered if there are Tracking Groups with Sub-Product Groups) */}
                     {hasSubGroupTabs && (
                       <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', scrollbarWidth: 'none' }}>
                         <button
                           onClick={() => setActiveCardTabs(prev => ({ ...prev, [s.id]: 'summary' }))}
                           style={{
                             padding: '5px 12px',
                             borderRadius: '14px',
                             border: 'none',
                             fontSize: '11px',
                             fontWeight: 600,
                             cursor: 'pointer',
                             whiteSpace: 'nowrap',
                             transition: 'all 0.2s ease',
                             backgroundColor: !isGroupTabActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                             color: !isGroupTabActive ? '#fff' : 'var(--text-muted)'
                           }}
                         >
                           Summary
                         </button>
                         {subGroupTrackingGroups.map((groupDef: any) => {
                           const isSelected = isGroupTabActive && activeTab === groupDef.id;
                           const res = s.trackingResults?.[groupDef.id];
                           const isHit = res?.isHit;
                           return (
                             <button
                               key={groupDef.id}
                               onClick={() => setActiveCardTabs(prev => ({ ...prev, [s.id]: groupDef.id }))}
                               style={{
                                 padding: '5px 12px',
                                 borderRadius: '14px',
                                 border: '1px solid',
                                 borderColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                                 fontSize: '11px',
                                 fontWeight: 600,
                                 cursor: 'pointer',
                                 whiteSpace: 'nowrap',
                                 transition: 'all 0.2s ease',
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: '5px',
                                 backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                                 color: isSelected ? '#60a5fa' : 'var(--text-muted)'
                               }}
                             >
                               {isHit && <CheckCircle size={10} color="#4ade80" />}
                               {groupDef.name}
                             </button>
                           );
                         })}
                       </div>
                     )}

                     {/* Tab Content */}
                     {!isGroupTabActive ? (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                         {sortedTrackingGroups.map((groupDef: any) => {
                           const res = s.trackingResults?.[groupDef.id];
                           if (!res) return null;
                           const resTargetType = res.definitionType === 'new_customer' ? 'UBA' : (res.targetType || groupDef.targetType || 'STT');
                           const actual = getGroupActual(res);
                           const target = res.targetValue || 0;
                           const pct = target > 0 ? (actual / target) * 100 : (actual > 0 ? 100 : 0);
                           const hasSubGroups = (groupDef.hasSubGroups && groupDef.subGroups && Object.keys(groupDef.subGroups).length > 0) || (res.subGroupsList && res.subGroupsList.length > 0);

                           if (res.definitionType === 'new_customer') {
                             return (
                               <div key={groupDef.id} style={{ background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))', borderRadius: '12px', padding: '16px', border: res.isHit ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                 <div style={{ textAlign: 'center', marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                    {res.isHit ? <CheckCircle size={16} color="#4ade80" /> : <Circle size={16} color="var(--text-muted)" />}
                                    <span style={{ fontSize: '15px', color: res.isHit ? '#fff' : 'var(--text-main)', fontWeight: 600, letterSpacing: '0.02em' }}>{res.name}</span>
                                 </div>
                                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
                                   <div style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px' }}>
                                     <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Buying Count</div>
                                     <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)', textShadow: '0 2px 10px rgba(59, 130, 246, 0.2)' }}>{res.actualUBA}</div>
                                   </div>
                                   <div style={{ paddingLeft: '16px' }}>
                                     <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>New Customers</div>
                                     <div style={{ fontSize: '28px', fontWeight: 700, color: 'white' }}>{res.targetValue}</div>
                                   </div>
                                 </div>
                               </div>
                             );
                           }

                           return (
                             <div 
                               key={groupDef.id} 
                               onClick={() => {
                                 if (hasSubGroups) setActiveCardTabs(prev => ({ ...prev, [s.id]: groupDef.id }));
                               }}
                               style={{ 
                                 background: 'rgba(0,0,0,0.2)', 
                                 padding: '12px', 
                                 borderRadius: '8px', 
                                 cursor: hasSubGroups ? 'pointer' : 'default',
                                 border: res.isHit ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                                 transition: 'all 0.2s ease'
                               }}
                             >
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', marginBottom: '8px' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: res.isHit ? '#fff' : 'var(--text-main)', fontWeight: res.isHit ? 600 : 500 }}>
                                   {res.isHit ? <CheckCircle size={14} color="#4ade80" /> : <Circle size={14} color="var(--text-muted)" />}
                                   <span>{res.name}</span>
                                 </div>
                                 <div style={{ fontSize: '12px', fontWeight: 600, color: res.isHit ? '#4ade80' : 'var(--text-muted)' }}>
                                   {pct.toFixed(0)}%
                                 </div>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                 <span>Actual: {resTargetType === 'STT' ? formatCurrency(actual) : `${actual} UBA`}</span>
                                 <span>Target: {resTargetType === 'STT' ? formatCurrency(res.targetValue) : res.targetValue}</span>
                               </div>
                               {renderProgressBar(actual, target)}
                             </div>
                           );
                         })}
                       </div>
                     ) : (() => {
                        const res = s.trackingResults?.[activeTab];
                        if (!res) return <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data for this tracking group.</div>;
                        const resTargetType = res.definitionType === 'new_customer' ? 'UBA' : (res.targetType || 'STT');
                        const actual = getGroupActual(res);

                        return (
                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', border: res.isHit ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)' }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                   {res.isHit ? <CheckCircle size={14} color="#4ade80" /> : <Circle size={14} color="var(--text-muted)" />}
                                   <span style={{ fontSize: '14px', color: res.isHit ? 'white' : 'var(--text-muted)', fontWeight: res.isHit ? 600 : 400 }}>{res.name}</span>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                   {resTargetType === 'STT' ? formatCurrency(actual) : `${actual} UBA`} 
                                   {' '} / {' '} 
                                   {resTargetType === 'STT' ? formatCurrency(res.targetValue) : res.targetValue}
                                </span>
                             </div>
                             {renderProgressBar(actual, res.targetValue)}

                             {res.subGroupsList && res.subGroupsList.length > 0 && (
                               <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                 <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Sub-Product Groups ({res.subGroupsList.length})</div>
                                 {res.subGroupsList.map((sub: any) => (
                                   <div key={sub.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                         {sub.isHit ? <CheckCircle size={12} color="#4ade80" /> : <Circle size={12} color="var(--text-muted)" />}
                                         <span style={{ color: sub.isHit ? '#fff' : 'var(--text-main)', fontWeight: sub.isHit ? 600 : 400 }}>{sub.name}</span>
                                         {sub.items && sub.items.length > 0 && (
                                           <span 
                                             title={`Included Item Codes:\n${sub.items.join(', ')}`}
                                             style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', opacity: 0.7, padding: '2px' }}
                                           >
                                             <Info size={12} color="var(--accent-primary)" />
                                           </span>
                                         )}
                                       </div>
                                       <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                         {resTargetType === 'STT' ? formatCurrency(sub.actualSTT) : `${sub.actualUBA} UBA`} / {resTargetType === 'STT' ? formatCurrency(sub.targetValue) : sub.targetValue}
                                       </span>
                                     </div>
                                     {renderProgressBar(resTargetType === 'STT' ? sub.actualSTT : sub.actualUBA, sub.targetValue)}
                                   </div>
                                 ))}
                               </div>
                             )}
                          </div>
                        );
                     })()}
                  </div>
                );
             })}
           </div>
        </div>
      )}
    </div>
  );
};

export default IncentiveDetails;
