import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

interface DashboardData {
  target: number;
  mtdSales: number;
  mtdVolume: number;
  gsr: number;
  bsr: number;
  balance: number;
  uba: number;
  ubaTarget: number;
  cml: number;
  vd30: any[];
  categories: any[];
  channels: any[];
  geo: any[];
  salesmen: any[];
  excludedSalesmen: string[];
  excludedVd30Salesmen: string[];
  frequency: { f1: number, f2: number, f3: number, f4: number };
}

export const useDashboardData = (selectedTeam: string = 'all', forceAllSalesmen: boolean = false) => {
  const { currentUser, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    target: 0,
    mtdSales: 0,
    mtdVolume: 0,
    gsr: 0,
    bsr: 0,
    balance: 0,
    uba: 0,
    ubaTarget: 0,
    cml: 0,
    vd30: [],
    categories: [],
    channels: [],
    geo: [],
    salesmen: [],
    excludedSalesmen: [],
    excludedVd30Salesmen: [],
    frequency: { f1: 0, f2: 0, f3: 0, f4: 0 },
  });

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch user data first to get their salesmanId and team
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const salesmanId = userData?.salesmanId;
        const team = userData?.team;

        const [metricsSnap, sttSnap, vd30Snap, teamSnap, settingsSnap, refVd30Snap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'dashboard_metrics')),
          getDocs(collection(db, 'salesman_targets')),
          getDocs(collection(db, 'vd30_targets')),
          getDocs(collection(db, 'reference_team_service')),
          getDoc(doc(db, 'settings', 'performance_panel')),
          getDocs(collection(db, 'reference_vd30')),
          getDocs(collection(db, 'users'))
        ]);
        
        const userAvatars: Record<string, string> = {};
        const userNames: Record<string, string> = {};
        usersSnap.forEach(d => {
          const u = d.data();
          if (u.salesmanId) {
            userAvatars[String(u.salesmanId)] = u.photoURL || '';
            if (u.name) userNames[String(u.salesmanId)] = u.name;
          }
        });
        
        const excludedSalesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_salesmen || []) : [];
        const excludedVd30Salesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_vd30_salesmen || []) : [];
        
        const vd30DescMap: Record<string, string> = {};
        refVd30Snap.forEach(d => {
          const v = d.data();
          if (v.vd30_code) {
            vd30DescMap[v.vd30_code] = v.vd30_description || '';
          }
        });

        let allowedSalesmen = new Set<string>();

        // Filter based on role
        if (forceAllSalesmen) {
          teamSnap.forEach(d => {
            allowedSalesmen.add(String(d.data().salesman_code));
          });
        } else if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamSnap.forEach(d => {
            const row = d.data();
            if (supervisorTeams.includes(row.team)) allowedSalesmen.add(String(row.salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamSnap.forEach(d => {
            const row = d.data();
            if (selectedTeam === 'all' || row.team === selectedTeam) {
              allowedSalesmen.add(String(row.salesman_code));
            }
          });
        }

        let totalMtdSales = 0;
        let totalMtdVolume = 0;
        let totalGsr = 0;
        let totalBsr = 0;
        let totalTarget = 0;
        let totalUba = 0;
        let totalCml = 0;
        let totalUbaTarget = 0;
        let totalF1 = 0, totalF2 = 0, totalF3 = 0, totalF4 = 0;
        const vd30Actuals: Record<string, number> = {};
        const vd30Targets: Record<string, number> = {};
        const categoriesMap: Record<string, number> = {};
        const channelsMap: Record<string, number> = {};
        const geoMap: Record<string, number> = {};
        const salesmenData: Record<string, any> = {};

        // Aggregate Metrics
        metricsSnap.forEach(d => {
          if (!allowedSalesmen.has(d.id)) return;
          const m = d.data();
          totalMtdSales += (m.mtd_net_value || 0);
          totalMtdVolume += (m.mtd_volume || 0);
          totalGsr += (m.gsr || 0);
          totalBsr += (m.bsr || 0);
          totalCml += (m.cml_count || 0);
          // Calculate Frequency
          let f1 = 0, f2 = 0, f3 = 0, f4 = 0;
          if (m.frequency) {
            f1 = m.frequency.f1 || 0;
            f2 = m.frequency.f2 || 0;
            f3 = m.frequency.f3 || 0;
            f4 = m.frequency.f4 || 0;
            totalF1 += f1;
            totalF2 += f2;
            totalF3 += f3;
            totalF4 += f4;
          }

          // Use Frequency sum for accurate UBA if available
          const accurateUba = m.frequency ? (f1 + f2 + f3 + f4) : (m.uba || 0);
          totalUba += accurateUba;

          let salesmanVd30ActualMap: Record<string, number> = {};
          if (m.vd30_placements) {
            Object.keys(m.vd30_placements).forEach(k => {
              const val = m.vd30_placements[k];
              vd30Actuals[k] = (vd30Actuals[k] || 0) + val;
              salesmanVd30ActualMap[k] = val;
            });
          }
          if (m.categories) Object.keys(m.categories).forEach(k => categoriesMap[k] = (categoriesMap[k] || 0) + m.categories[k]);
          if (m.channels) Object.keys(m.channels).forEach(k => channelsMap[k] = (channelsMap[k] || 0) + m.channels[k]);
          
          const geoSource = role === 'salesman' ? m.brgy : m.town;
          if (geoSource) Object.keys(geoSource).forEach(k => geoMap[k] = (geoMap[k] || 0) + geoSource[k]);

          salesmenData[d.id] = {
            id: d.id,
            name: userNames[d.id] || m.salesman_name || d.id,
            mtdSales: m.mtd_net_value || 0,
            uba: accurateUba,
            target: 0,
            ubaTarget: 0,
            vd30ActualMap: salesmanVd30ActualMap,
            vd30TargetMap: {},
            vd30: 0,
            vd30Target: 0,
            photoURL: userAvatars[d.id] || ''
          };
        });

        // Aggregate Targets
        sttSnap.forEach(d => {
          if (!allowedSalesmen.has(d.id)) return;
          const t = d.data();
          const target = parseFloat(t.stt_target) || 0;
          const ubaTgt = parseFloat(t['uba target']) || 0;
          totalTarget += target;
          totalUbaTarget += ubaTgt;
          
          if (salesmenData[d.id]) {
            salesmenData[d.id].target = target;
            salesmenData[d.id].ubaTarget = ubaTgt;
          }
        });

        vd30Snap.forEach(d => {
          if (!allowedSalesmen.has(d.id)) return;
          const t = d.data();
          let salesmanVd30TargetMap: Record<string, number> = {};
          Object.keys(t).forEach(k => {
            if (k.startsWith('F')) {
              const val = parseFloat(t[k]) || 0;
              vd30Targets[k] = (vd30Targets[k] || 0) + val;
              salesmanVd30TargetMap[k] = val;
            }
          });
          if (salesmenData[d.id]) {
            salesmenData[d.id].vd30TargetMap = salesmanVd30TargetMap;
          }
        });
        
        // Evaluate per-salesman VD30 performance based on actuals meeting targets
        Object.values(salesmenData).forEach(s => {
          let targetCount = 0;
          let hitCount = 0;
          if (s.vd30TargetMap) {
            Object.keys(s.vd30TargetMap).forEach(k => {
              const tgt = s.vd30TargetMap[k];
              if (tgt > 0) {
                targetCount++;
                const act = (s.vd30ActualMap && s.vd30ActualMap[k]) || 0;
                if (act >= tgt) hitCount++;
              }
            });
          }
          if (s.id === 'KNE0006' || s.id === 'KNE0005') {
            console.log(`[DEBUG] ${s.id} Target Map:`, s.vd30TargetMap);
            console.log(`[DEBUG] ${s.id} Actual Map:`, s.vd30ActualMap);
          }
          s.vd30 = hitCount;
          s.vd30Target = targetCount;
        });

        const balance = Math.max(totalTarget - totalMtdSales, 0);

        const vd30Formatted = Object.keys(vd30Targets).map(k => ({
          name: k.split('_')[0], // e.g. "F01"
          code: k,
          description: vd30DescMap[k] || '',
          target: Math.round(vd30Targets[k] || 0),
          actual: vd30Actuals[k] || 0,
        })).sort((a, b) => a.name.localeCompare(b.name));

        const sortMap = (map: Record<string, number>) => Object.keys(map).map(k => ({ name: k, value: map[k] })).sort((a, b) => b.value - a.value);

        setData({
          target: totalTarget,
          mtdSales: totalMtdSales,
          mtdVolume: totalMtdVolume,
          gsr: totalGsr,
          bsr: totalBsr,
          balance,
          uba: totalUba,
          ubaTarget: totalUbaTarget,
          cml: totalCml,
          vd30: vd30Formatted,
          categories: sortMap(categoriesMap),
          channels: sortMap(channelsMap),
          geo: sortMap(geoMap).slice(0, 10),
          salesmen: Object.values(salesmenData).sort((a: any, b: any) => b.mtdSales - a.mtdSales),
          excludedSalesmen,
          excludedVd30Salesmen,
          frequency: { f1: totalF1, f2: totalF2, f3: totalF3, f4: totalF4 }
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, role, selectedTeam, forceAllSalesmen]);

  return { loading, data };
};
