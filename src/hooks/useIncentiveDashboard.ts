import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useUsersCache } from './useUsersCache';

export const useIncentiveDashboard = (programId: string | undefined, _selectedTeam: string = 'all') => {
  const { currentUser, role, salesmanId, team, selectedMonth } = useAuth();
  const { usersCache, loading: usersLoading } = useUsersCache();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    if (!programId || !currentUser || usersLoading) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Program Details
        const progSnap = await getDoc(doc(db, 'incentives_programs', programId));
        if (!progSnap.exists()) {
          setLoading(false);
          return;
        }
        const progData: any = { id: progSnap.id, ...progSnap.data() };
        setProgram(progData);

        // Determine month to fetch based on Data View (selectedMonth)
        // If selectedMonth is 'current' or undefined, use currentLiveMonth
        // (We fetch currentLiveMonth a bit lower down, so let's just define it here)
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const cobDate = globalDoc.exists() ? globalDoc.data().cobDate : new Date().toISOString().slice(0, 10);
        const currentLiveMonth = cobDate ? cobDate.slice(0, 7) : new Date().toISOString().slice(0, 7);

        const monthToFetch = (selectedMonth && selectedMonth !== 'current') ? selectedMonth : currentLiveMonth;

        // (Moved COB date logic above)

        // Fetch references to know the teams
        const teamSnap = await getDoc(doc(db, 'reference_team_service', 'all'));
        const teamDataRaw = teamSnap.exists() ? teamSnap.data() : {};
        const teamData = Object.keys(teamDataRaw).map(k => ({ id: k, ...teamDataRaw[k] }));

        const allowedSalesmen = new Set<string>();
        const leaderboardSalesmen = new Set<string>();

        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
          leaderboardSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor') {
          const supervisorTeams = team ? team.split(',').map((t: string) => t.trim()) : [];
          teamData.forEach((row: any) => {
            if (supervisorTeams.includes(row.team)) {
              allowedSalesmen.add(String(row.salesman_code));
              leaderboardSalesmen.add(String(row.salesman_code));
            }
          });
        } else {
          teamData.forEach((row: any) => {
            allowedSalesmen.add(String(row.salesman_code));
            leaderboardSalesmen.add(String(row.salesman_code));
          });
        }

        const aggregatedAchievements: Record<string, Record<string, { stt: number, uba: number, uba_customers?: Set<string>, daily?: Record<string, {stt: number, uba: number}> }>> = {};

        // Fetch Data for the selected month
        let metricsRaw: any = {};
        if (monthToFetch === currentLiveMonth) {
           const summarySnap = await getDoc(doc(db, 'dashboard_metrics_summary', 'all'));
           metricsRaw = summarySnap.exists() ? summarySnap.data() : {};

           // If live data has no transactional data (e.g., cleared before a new upload, or only has CML data), fallback to snapshot
           const hasTransactionalData = Object.values(metricsRaw).some((m: any) => m.mtd_net_value !== undefined || m.incentives !== undefined);
           
           if (!hasTransactionalData) {
              const snap = await getDoc(doc(db, 'snapshots', monthToFetch));
              if (snap.exists()) {
                 metricsRaw = snap.data().dashboard_metrics || {};
              }
           }
        } else {
           const snap = await getDoc(doc(db, 'snapshots', monthToFetch));
           if (snap.exists()) {
              metricsRaw = snap.data().dashboard_metrics || {};
           }
        }

        // Aggregate achievements for the program
        Object.keys(metricsRaw).forEach(salesmanCode => {
           if (!leaderboardSalesmen.has(salesmanCode)) return;

           const m = metricsRaw[salesmanCode];
           if (m.incentives && m.incentives[programId]) {
              if (!aggregatedAchievements[salesmanCode]) {
                 aggregatedAchievements[salesmanCode] = {};
              }

              Object.keys(m.incentives[programId]).forEach(groupId => {
                 const trackingGroupDef = progData.trackingGroups?.[groupId];
                 const measureType = trackingGroupDef?.ubaMeasureType || 'Month-on-month';

                 if (!aggregatedAchievements[salesmanCode][groupId]) {
                    aggregatedAchievements[salesmanCode][groupId] = { stt: 0, uba: 0, uba_customers: new Set(), daily: {} };
                 }
                 aggregatedAchievements[salesmanCode][groupId].stt += m.incentives[programId][groupId].stt;

                 if (m.incentives[programId][groupId].daily) {
                    if (!aggregatedAchievements[salesmanCode][groupId].daily) {
                       aggregatedAchievements[salesmanCode][groupId].daily = {};
                    }
                    Object.keys(m.incentives[programId][groupId].daily).forEach(d => {
                       if (!aggregatedAchievements[salesmanCode][groupId].daily![d]) {
                          aggregatedAchievements[salesmanCode][groupId].daily![d] = { stt: 0, uba: 0 };
                       }
                       aggregatedAchievements[salesmanCode][groupId].daily![d].stt += m.incentives[programId][groupId].daily[d].stt;
                       aggregatedAchievements[salesmanCode][groupId].daily![d].uba += m.incentives[programId][groupId].daily[d].uba;
                    });
                 }

                 if (measureType === 'Everbought' && m.incentives[programId][groupId].uba_customers) {
                    const customersArr = m.incentives[programId][groupId].uba_customers;
                    if (Array.isArray(customersArr)) {
                       customersArr.forEach((c: string) => aggregatedAchievements[salesmanCode][groupId].uba_customers!.add(c));
                    }
                    aggregatedAchievements[salesmanCode][groupId].uba = aggregatedAchievements[salesmanCode][groupId].uba_customers!.size;
                 } else {
                    aggregatedAchievements[salesmanCode][groupId].uba += m.incentives[programId][groupId].uba;
                 }
              });
           }
        });

        const userAvatars: Record<string, string> = {};
        const userNames: Record<string, string> = {};
        usersCache.forEach(u => {
          if (u.salesmanId) {
            userAvatars[String(u.salesmanId)] = u.photoURL || '';
            if (u.name) userNames[String(u.salesmanId)] = u.name;
          }
        });

        // Build the salesman array with their targets and achievements
        const salesmenList: any[] = [];
        
        // We only want to include participating salesmen
        const participating = progData.participatingSalesmen || [];

        participating.forEach((salesmanCode: string) => {
           if (!leaderboardSalesmen.has(salesmanCode)) return;

           const achievements = aggregatedAchievements[salesmanCode] || {};
           
           // Calculate total targets hit
           let targetsHit = 0;
           let totalTargets = 0;
           let totalSTT = 0;
           let totalTargetSTT = 0;

           const trackingResults: any = {};

           Object.values(progData.trackingGroups || {}).forEach((group: any) => {
              totalTargets++;
              const actual = achievements[group.id] || { stt: 0, uba: 0 };
              
              // Determine target for this salesman
              let targetValue = 0;
              const indivTargetData = group.individualTargets && group.individualTargets[salesmanCode];
              
              if (group.definitionType === 'new_customer') {
                 targetValue = metricsRaw[salesmanCode]?.new_customer_count || 0;
              } else if (typeof indivTargetData === 'number') {
                 // Flat target
                 targetValue = indivTargetData;
              } else if (typeof indivTargetData === 'object' && indivTargetData !== null) {
                 // Target specifically for the selected month
                 if (indivTargetData[monthToFetch]) {
                    targetValue = indivTargetData[monthToFetch];
                 } else if (indivTargetData['flat']) {
                    targetValue = indivTargetData['flat']; // fallback to flat
                 }
              }

              const achievedVal = group.targetType === 'STT' ? actual.stt : actual.uba;
              const isHit = targetValue > 0 && achievedVal >= targetValue;
              if (isHit) targetsHit++;

              if (group.targetType === 'STT') {
                 totalSTT += actual.stt;
                 totalTargetSTT += targetValue;
              }

              trackingResults[group.id] = {
                 ...group,
                 actualSTT: actual.stt,
                 actualUBA: actual.uba,
                 daily: actual.daily,
                 targetValue,
                 isHit
              };
           });

           salesmenList.push({
              id: salesmanCode,
              name: userNames[salesmanCode] || salesmanCode,
              photoURL: userAvatars[salesmanCode] || '',
              team: teamData.find(r => r.salesman_code === salesmanCode)?.team || '',
              targetsHit,
              totalTargets,
              totalSTT,
              totalTargetSTT,
              trackingResults,
              isAllowed: allowedSalesmen.has(salesmanCode)
           });
        });

        // Sort leaderboard by targets hit, then by STT
        salesmenList.sort((a, b) => {
           if (b.targetsHit !== a.targetsHit) return b.targetsHit - a.targetsHit;
           return b.totalSTT - a.totalSTT;
        });

        setDashboardData({
           salesmen: salesmenList,
           leaderboard: salesmenList // can limit if needed
        });

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [programId, currentUser, role, usersLoading, salesmanId, team, selectedMonth]);

  return { loading, program, dashboardData };
};
