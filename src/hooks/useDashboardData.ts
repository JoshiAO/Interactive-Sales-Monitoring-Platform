import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set, del } from 'idb-keyval';
import { useUsersCache } from './useUsersCache';
import { evaluateGamification } from '../utils/evaluateGamification';

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
  rawAchievements?: Record<string, any>;
  rawDailyPoints?: Record<string, any>;
  weeklyCommitments?: any;
  historicalMedals?: any;
  refVd30Items: any[];
  cobDate?: string;
  weekMapping?: Record<string, { start: string; end: string }>;
}

export const useDashboardData = (selectedTeam: string = 'all', forceAllSalesmen: boolean | 'team' = false) => {
  const { currentUser, role, salesmanId, team, selectedMonth } = useAuth();
  const { usersCache, loading: usersLoading } = useUsersCache();
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
    weeklyCommitments: {},
    historicalMedals: {},
    refVd30Items: [],
    cobDate: new Date().toISOString().split('T')[0],
    weekMapping: {}
  });

  useEffect(() => {
    if (!currentUser || usersLoading) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch COB Date and lastUpload for cache validation
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastDataUpload = globalData?.lastDataUpload || 0;
        const lastReferenceUpload = globalData?.lastReferenceUpload || 0;
        const cobDate = globalData?.cobDate || new Date().toISOString().split('T')[0];
        const weekMapping = globalData?.weekMapping || {};

        const metricsCacheKey = 'dashboard_metrics_cache_v2';
        const referenceCacheKey = 'dashboard_reference_cache_v2';

        const withTimeout = <T>(promise: Promise<T>, ms: number = 1000): Promise<T | null> => {
          return Promise.race([
            promise,
            new Promise<null>(resolve => setTimeout(() => resolve(null), ms))
          ]);
        };

        const cachedMetrics = await withTimeout(get(metricsCacheKey));
        const cachedReference = await withTimeout(get(referenceCacheKey));
        const cachedMetricsUpload = await withTimeout(get('dashboard_lastDataUpload'));
        const cachedRefUpload = await withTimeout(get('dashboard_lastReferenceUpload'));

        let metricsData: any[] = [];
        let sttData: any[] = [];
        let vd30Data: any[] = [];
        let teamData: any[] = [];
        let refVd30Data: any[] = [];
        let snapAchievementsData: any = null;
        let snapWeeklyCommitmentsData: any = null;
        let snapHistoricalMedalsData: any = null;

        if (selectedMonth && selectedMonth !== 'current') {
          const snapshotSnap = await getDoc(doc(db, 'snapshots', selectedMonth));
          if (snapshotSnap.exists()) {
            const snapData = snapshotSnap.data();
            
            const metricsRaw = snapData.dashboard_metrics || {};
            metricsData = Object.keys(metricsRaw).map(k => ({ id: k, ...metricsRaw[k] }));

            const sttRaw = snapData.salesman_targets || {};
            sttData = Object.keys(sttRaw).map(k => ({ id: k, ...sttRaw[k] }));

            const vd30Raw = snapData.vd30_targets || {};
            vd30Data = Object.keys(vd30Raw).map(k => ({ id: k, ...vd30Raw[k] }));

            const teamRaw = snapData.reference_team_service || {};
            teamData = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));

            const refVd30Raw = snapData.reference_vd30 || {};
            refVd30Data = Object.keys(refVd30Raw).map(k => ({ id: k, ...refVd30Raw[k] }));

            snapAchievementsData = snapData.achievements || {};
            snapWeeklyCommitmentsData = snapData.weekly_commitments || {};
            snapHistoricalMedalsData = snapData.historical_medals || {};
          }
        } else {
          // 1. Deep Cache: Targets and References (Monthly updates) - FETCH FIRST to know teams
          if (cachedReference && cachedRefUpload === lastReferenceUpload) {
            sttData = cachedReference.sttData;
            vd30Data = cachedReference.vd30Data;
            teamData = cachedReference.teamData;
            refVd30Data = cachedReference.refVd30Data;
          } else {
            const [sttSnap, vd30Snap, teamSnap, refVd30Snap] = await Promise.all([
              getDoc(doc(db, 'salesman_targets', 'all')),
              getDoc(doc(db, 'vd30_targets', 'all')),
              getDoc(doc(db, 'reference_team_service', 'all')),
              getDoc(doc(db, 'reference_vd30', 'all'))
            ]);

            const sttRaw = sttSnap.exists() ? sttSnap.data() : {};
            sttData = Object.keys(sttRaw).map(k => ({ id: k, ...sttRaw[k] }));

            const vd30Raw = vd30Snap.exists() ? vd30Snap.data() : {};
            vd30Data = Object.keys(vd30Raw).map(k => ({ id: k, ...vd30Raw[k] }));

            const teamRaw = teamSnap.exists() ? teamSnap.data() : {};
            teamData = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));

            const refVd30Raw = refVd30Snap.exists() ? refVd30Snap.data() : {};
            refVd30Data = Object.keys(refVd30Raw).map(k => ({ id: k, ...refVd30Raw[k] }));

            await withTimeout(set(referenceCacheKey, { sttData, vd30Data, teamData, refVd30Data }));
            await withTimeout(set('dashboard_lastReferenceUpload', lastReferenceUpload));
          }

          // 2. Fast Cache: Dashboard Metrics (Hourly updates)
          if (cachedMetrics && cachedMetricsUpload === lastDataUpload) {
            metricsData = cachedMetrics;
          } else {
            let metricsRaw: Record<string, any> = {};
            if (role === 'admin' || role === 'manager') {
              const metricsSnap = await getDoc(doc(db, 'dashboard_metrics', 'all'));
              metricsRaw = metricsSnap.exists() ? metricsSnap.data() : {};
            } else {
              // Salesmen and Supervisors get the summary doc for leaderboard
              const summarySnap = await getDoc(doc(db, 'dashboard_metrics_summary', 'all'));
              metricsRaw = summarySnap.exists() ? summarySnap.data() : {};

              // Determine which specific salesmen we are allowed to fetch granular data for
              const targetSalesmen: string[] = [];
              if (role === 'salesman' && salesmanId) {
                targetSalesmen.push(String(salesmanId));
              } else if (role === 'supervisor') {
                const supervisorTeams = team ? team.split(',').map((t: string) => t.trim()) : [];
                teamData.forEach((row: any) => {
                  if (supervisorTeams.includes(row.team)) {
                    targetSalesmen.push(String(row.salesman_code));
                  }
                });
              }

              // Fetch granular data individually
              if (targetSalesmen.length > 0) {
                const granularPromises = targetSalesmen.map(id => getDoc(doc(db, 'dashboard_metrics', id)));
                const granularSnaps = await Promise.all(granularPromises);
                granularSnaps.forEach(snap => {
                   if (snap.exists()) {
                      // Merge granular properties (categories, channels, brgy, etc.) into the summary object
                      metricsRaw[snap.id] = { ...metricsRaw[snap.id], ...snap.data() };
                   }
                });
              }
            }
            metricsData = Object.keys(metricsRaw).map(k => ({ id: k, ...metricsRaw[k] }));
            await withTimeout(set(metricsCacheKey, metricsData));
            await withTimeout(set('dashboard_lastDataUpload', lastDataUpload));
          }
        }

        // Fetch non-cached data
        const settingsSnap = await getDoc(doc(db, 'settings', 'performance_panel'));

        const userAvatars: Record<string, string> = {};
        const userNames: Record<string, string> = {};
        const userTypes: Record<string, string> = {};
        usersCache.forEach(u => {
          if (u.salesmanId) {
            userAvatars[String(u.salesmanId)] = u.photoURL || '';
            if (u.name) userNames[String(u.salesmanId)] = u.name;
            if (u.salesmanType) userTypes[String(u.salesmanId)] = u.salesmanType;
          }
        });

        const excludedSalesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_salesmen || []) : [];
        const excludedVd30Salesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_vd30_salesmen || []) : [];

        const vd30DescMap: Record<string, string> = {};
        refVd30Data.forEach((v: any) => {
          if (v.vd30_code) {
            vd30DescMap[v.vd30_code] = v.vd30_description || '';
          }
        });

        const allowedSalesmen = new Set<string>();
        const leaderboardSalesmen = new Set<string>();

        // Filter based on role
        if (forceAllSalesmen === true) {
          teamData.forEach((row: any) => {
            allowedSalesmen.add(String(row.salesman_code));
            leaderboardSalesmen.add(String(row.salesman_code));
          });
        } else if (forceAllSalesmen === 'team' || role === 'supervisor') {
          const supervisorTeams = team ? team.split(',').map((t: string) => t.trim()) : [];
          teamData.forEach((row: any) => {
            if (supervisorTeams.includes(row.team)) {
              allowedSalesmen.add(String(row.salesman_code));
              leaderboardSalesmen.add(String(row.salesman_code));
            }
          });
        } else if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
          // Salesmen need to see their peers in the leaderboard
          teamData.forEach((row: any) => {
            leaderboardSalesmen.add(String(row.salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamData.forEach((row: any) => {
            if (selectedTeam === 'all' || row.team === selectedTeam) {
              allowedSalesmen.add(String(row.salesman_code));
              leaderboardSalesmen.add(String(row.salesman_code));
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
        const globalVd30ProductDetails: Record<string, { customers: number, volume: number }> = {};

        // Aggregate Metrics
        metricsData.forEach((m: any) => {
          if (!leaderboardSalesmen.has(m.id)) return;
          const isAggregated = allowedSalesmen.has(m.id);

          let f1 = 0, f2 = 0, f3 = 0, f4 = 0;
          if (m.frequency) {
            f1 = m.frequency.f1 || 0;
            f2 = m.frequency.f2 || 0;
            f3 = m.frequency.f3 || 0;
            f4 = m.frequency.f4 || 0;
          }
          const accurateUba = m.frequency ? (f1 + f2 + f3 + f4) : (m.uba || 0);

          const salesmanVd30ActualMap: Record<string, number> = {};
          if (m.vd30_placements) {
            Object.keys(m.vd30_placements).forEach(k => {
              salesmanVd30ActualMap[k] = m.vd30_placements[k];
            });
          }

          if (isAggregated) {
            totalMtdSales += (m.mtd_net_value || 0);
            totalMtdVolume += (m.mtd_volume || 0);
            totalGsr += (m.gsr || 0);
            totalBsr += (m.bsr || 0);
            totalCml += (m.cml_count || 0);
            totalF1 += f1;
            totalF2 += f2;
            totalF3 += f3;
            totalF4 += f4;
            totalUba += accurateUba;

            if (m.vd30_placements) {
              Object.keys(m.vd30_placements).forEach(k => {
                vd30Actuals[k] = (vd30Actuals[k] || 0) + m.vd30_placements[k];
              });
            }

            if (m.vd30_product_details) {
              Object.keys(m.vd30_product_details).forEach(prodCode => {
                if (!globalVd30ProductDetails[prodCode]) {
                  globalVd30ProductDetails[prodCode] = { customers: 0, volume: 0 };
                }
                globalVd30ProductDetails[prodCode].customers += (m.vd30_product_details[prodCode].customers || 0);
                globalVd30ProductDetails[prodCode].volume += (m.vd30_product_details[prodCode].volume || 0);
              });
            }

            if (m.categories) Object.keys(m.categories).forEach(k => categoriesMap[k] = (categoriesMap[k] || 0) + m.categories[k]);
            if (m.channels) Object.keys(m.channels).forEach(k => channelsMap[k] = (channelsMap[k] || 0) + m.channels[k]);

            const geoSource = role === 'salesman' ? m.brgy : m.town;
            if (geoSource) Object.keys(geoSource).forEach(k => geoMap[k] = (geoMap[k] || 0) + geoSource[k]);
          }

          salesmenData[m.id] = {
            id: m.id,
            name: userNames[m.id] || m.salesman_name || m.id,
            mtdSales: m.mtd_net_value || 0,
            uba: accurateUba,
            target: 0,
            ubaTarget: 0,
            vd30ActualMap: salesmanVd30ActualMap,
            vd30TargetMap: {},
            vd30: 0,
            vd30Target: 0,
            cmlSmall: m.sss_small_count || 0,
            cmlLarge: m.sss_large_count || 0,
            photoURL: userAvatars[m.id] || '',
            type: userTypes[m.id] || (() => {
              const td = teamData.find((r:any) => r.salesman_code === m.id);
              return td ? (td.service_model || td.service_type || td['Service Model'] || td.type || td.Type || 'Unknown') : 'Unknown';
            })(),
            team: teamData.find((r:any) => r.salesman_code === m.id)?.team || ''
          };
        });

        // Aggregate Targets
        sttData.forEach((t: any) => {
          if (!leaderboardSalesmen.has(t.id)) return;
          const target = parseFloat(t.stt_target) || 0;
          const ubaTgt = parseFloat(t['uba target']) || 0;
          
          if (allowedSalesmen.has(t.id)) {
            totalTarget += target;
            totalUbaTarget += ubaTgt;
          }

          if (salesmenData[t.id]) {
            salesmenData[t.id].target = target;
            salesmenData[t.id].ubaTarget = ubaTgt;
          }
        });

        vd30Data.forEach((t: any) => {
          if (!leaderboardSalesmen.has(t.id)) return;
          const salesmanVd30TargetMap: Record<string, number> = {};
          Object.keys(t).forEach(k => {
            if (k.startsWith('F')) {
              const val = parseFloat(t[k]) || 0;
              if (allowedSalesmen.has(t.id)) {
                vd30Targets[k] = (vd30Targets[k] || 0) + val;
              }
              salesmanVd30TargetMap[k] = val;
            }
          });
          if (salesmenData[t.id]) {
            salesmenData[t.id].vd30TargetMap = salesmanVd30TargetMap;
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
                const baseCode = k.split('_')[0];
                const act = (s.vd30ActualMap && (s.vd30ActualMap[baseCode] || s.vd30ActualMap[k])) || 0;
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

        const vd30Formatted = Object.keys(vd30Targets).map(k => {
          const baseCode = k.split('_')[0]; // e.g. "F01"
          return {
            name: baseCode, 
            code: k,
            description: vd30DescMap[k] || '',
            target: Math.round(vd30Targets[k] || 0),
            actual: vd30Actuals[baseCode] || vd30Actuals[k] || 0,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const sortMap = (map: Record<string, number>) => Object.keys(map).map(k => ({ name: k, value: map[k] })).sort((a, b) => b.value - a.value);

        // Fetch Weekly Achievements from Firestore
        const monthKey = cobDate.substring(0, 7); // e.g. "2026-06"
        const globalPointsMap: Record<string, { gold: number, silver: number, bronze: number, points: number }> = {};
        let rawWeeklyAchievements: Record<string, any> = {};

        let rawDailyPoints: Record<string, any> = {};

        try {
          let achData: any = {};
          if (selectedMonth && selectedMonth !== 'current') {
            achData = snapAchievementsData || {};
          } else {
            const achDoc = await getDoc(doc(db, 'achievements', monthKey));
            if (achDoc.exists()) achData = achDoc.data();
          }

          const weeklyMedals = achData.weekly_medals || {};
          rawDailyPoints = achData.daily_points || {};
          rawWeeklyAchievements = weeklyMedals;
          // Aggregate all weeks for the month
          Object.values(weeklyMedals).forEach((weekMap: any) => {
            Object.keys(weekMap).forEach(salesmanId => {
              if (!globalPointsMap[salesmanId]) globalPointsMap[salesmanId] = { gold: 0, silver: 0, bronze: 0, points: 0 };
              globalPointsMap[salesmanId].gold += weekMap[salesmanId].gold || 0;
              globalPointsMap[salesmanId].silver += weekMap[salesmanId].silver || 0;
              globalPointsMap[salesmanId].bronze += weekMap[salesmanId].bronze || 0;
              globalPointsMap[salesmanId].points += weekMap[salesmanId].points || 0;
            });
          });
        } catch (err) {
          console.error("Error fetching achievements:", err);
        }

        let weeklyCommitments = {};
        let historicalMedals = {};
        try {
          if (selectedMonth && selectedMonth !== 'current') {
            weeklyCommitments = snapWeeklyCommitmentsData || {};
            historicalMedals = snapHistoricalMedalsData || {};
          } else {
            const [commDoc, medDoc] = await Promise.all([
              getDoc(doc(db, 'weekly_commitments', monthKey)),
              getDoc(doc(db, 'historical_medals', monthKey))
            ]);
            if (commDoc.exists()) weeklyCommitments = commDoc.data();
            if (medDoc.exists()) historicalMedals = medDoc.data();
          }
        } catch (err) {
          console.error("Error fetching gamification data:", err);
        }

        // Attach medals to salesmenData and save to localStorage for avatar rendering
        Object.keys(salesmenData).forEach(id => {
          (salesmenData as any)[id].achievements = globalPointsMap[id] || { gold: 0, silver: 0, bronze: 0, points: 0 };
        });
        localStorage.setItem('salesman_achievements', JSON.stringify(globalPointsMap));

        // Attach aggregated product details to refVd30Items
        const refVd30ItemsWithStats = refVd30Data.map((item: any) => {
          const prodCode = String(item.product_code || item.id || '');
          const stats = globalVd30ProductDetails[prodCode] || { customers: 0, volume: 0 };
          return {
            ...item,
            customers: stats.customers,
            volume: stats.volume
          };
        });

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
          frequency: { f1: totalF1, f2: totalF2, f3: totalF3, f4: totalF4 },
          rawAchievements: rawWeeklyAchievements,
          rawDailyPoints,
          weeklyCommitments,
          historicalMedals,
          refVd30Items: refVd30ItemsWithStats,
          cobDate,
          weekMapping
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, role, selectedTeam, forceAllSalesmen, usersLoading, selectedMonth, salesmanId, team]);

  const forceEvaluateGamification = async (week: number) => {
    if (!data.salesmen || data.salesmen.length === 0) return;
    const monthKey = new Date().toISOString().substring(0, 7);
    
    // Fetch latest commitments just in time to avoid stale data issues
    let latestCommitments = data.weeklyCommitments;
    try {
      const commDoc = await getDoc(doc(db, 'weekly_commitments', monthKey));
      if (commDoc.exists()) latestCommitments = commDoc.data();
    } catch (e) {
      console.error(e);
    }
    
    await evaluateGamification(monthKey, week, data.salesmen, latestCommitments, usersCache, true);
    await del('dashboard_metrics_lastUpload'); // Invalidate cache to force fetch of new medals
  };

  return { loading, data, forceEvaluateGamification };
};
