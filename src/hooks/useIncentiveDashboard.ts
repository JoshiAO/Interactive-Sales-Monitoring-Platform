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

        const aggregatedAchievements: Record<string, Record<string, { stt: number, uba: number, uba_customers?: Set<string>, daily?: Record<string, {stt: number, uba: number}>, subGroups?: Record<string, { stt: number, uba: number }> }>> = {};

        // Helper to generate months in range
        const getMonthsInRange = (startStr?: string, endStr?: string) => {
           if (!startStr) return [monthToFetch];
           const start = new Date(startStr + '-01');
           const end = new Date((endStr || monthToFetch) + '-01');
           const targetEnd = new Date(monthToFetch + '-01');
           const effectiveEnd = end < targetEnd ? end : targetEnd;
           const months: string[] = [];
           const curr = new Date(start);
           while (curr <= effectiveEnd) {
              months.push(curr.toISOString().slice(0, 7));
              curr.setMonth(curr.getMonth() + 1);
           }
           return months.length > 0 ? months : [monthToFetch];
        };

        const programMonths = getMonthsInRange(progData.startMonth, monthToFetch);

        // Fetch Data for all program months up to monthToFetch
        const monthlyMetricsList: { month: string, data: any }[] = [];
        for (const mStr of programMonths) {
           let metricsRaw: any = {};
           if (mStr === currentLiveMonth) {
              const summarySnap = await getDoc(doc(db, 'dashboard_metrics_summary', 'all'));
              metricsRaw = summarySnap.exists() ? summarySnap.data() : {};
              const hasTransactionalData = Object.values(metricsRaw).some((m: any) => m.mtd_net_value !== undefined || m.incentives !== undefined);
              if (!hasTransactionalData) {
                 const snap = await getDoc(doc(db, 'snapshots', mStr));
                 if (snap.exists()) {
                    metricsRaw = snap.data().dashboard_metrics || {};
                 }
              }
           } else {
              const snap = await getDoc(doc(db, 'snapshots', mStr));
              if (snap.exists()) {
                 metricsRaw = snap.data().dashboard_metrics || {};
              }
           }
           monthlyMetricsList.push({ month: mStr, data: metricsRaw });
        }

        // Aggregate achievements across program months
        monthlyMetricsList.forEach(({ month: mStr, data: metricsRaw }) => {
           const isCurrentSelectedMonth = mStr === monthToFetch;

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

                    // STT accumulates across months if multi-month, or adds per month
                    if (isCurrentSelectedMonth || programMonths.length > 1) {
                       aggregatedAchievements[salesmanCode][groupId].stt += (m.incentives[programId][groupId].stt || 0);
                    }

                    if (isCurrentSelectedMonth && m.incentives[programId][groupId].daily) {
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

                    if (m.incentives[programId][groupId].subGroups) {
                       if (!aggregatedAchievements[salesmanCode][groupId].subGroups) {
                          aggregatedAchievements[salesmanCode][groupId].subGroups = {};
                       }
                       const subObj = m.incentives[programId][groupId].subGroups;
                       Object.keys(subObj).forEach(subId => {
                          if (!aggregatedAchievements[salesmanCode][groupId].subGroups![subId]) {
                             aggregatedAchievements[salesmanCode][groupId].subGroups![subId] = { stt: 0, uba: 0 };
                          }
                          if (isCurrentSelectedMonth || programMonths.length > 1) {
                             aggregatedAchievements[salesmanCode][groupId].subGroups![subId].stt += (subObj[subId].stt || 0);
                          }
                          if (isCurrentSelectedMonth) {
                             aggregatedAchievements[salesmanCode][groupId].subGroups![subId].uba = (subObj[subId].uba || 0);
                          }
                       });
                    }

                    if (measureType === 'Everbought') {
                       // Everbought accumulates unique customer IDs across ALL months in the program window
                       const customersArr = m.incentives[programId][groupId].uba_customers;
                       if (Array.isArray(customersArr)) {
                          customersArr.forEach((c: string) => aggregatedAchievements[salesmanCode][groupId].uba_customers!.add(c));
                       }
                       aggregatedAchievements[salesmanCode][groupId].uba = aggregatedAchievements[salesmanCode][groupId].uba_customers!.size;
                    } else {
                       // Month-on-month only uses the current selected month's UBA count
                       if (isCurrentSelectedMonth) {
                          aggregatedAchievements[salesmanCode][groupId].uba = m.incentives[programId][groupId].uba || 0;
                       }
                    }
                 });
              }
           });
        });

        const latestMetricsData = monthlyMetricsList.find(m => m.month === monthToFetch)?.data || monthlyMetricsList[monthlyMetricsList.length - 1]?.data || {};

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

            const sortedTrackingGroups = Object.values(progData.trackingGroups || {}).sort((a: any, b: any) => {
               const timeA = a.createdAt || Number(String(a.id || '').replace(/[^0-9]/g, '')) || 0;
               const timeB = b.createdAt || Number(String(b.id || '').replace(/[^0-9]/g, '')) || 0;
               if (timeA !== timeB) return timeA - timeB;
               return (a.name || '').localeCompare(b.name || '');
            });

            sortedTrackingGroups.forEach((group: any) => {
               totalTargets++;
               const actual = achievements[group.id] || { stt: 0, uba: 0 };
               
               // Compute sub-groups progress & target hit per salesman FIRST
               let subGroupsList: any[] = [];
               if (group.hasSubGroups && group.subGroups) {
                 const subAch = actual.subGroups || {};
                 subGroupsList = Object.values(group.subGroups).map((subGroup: any) => {
                   let subTarget = 0;
                   const subIndiv = subGroup.individualTargets && subGroup.individualTargets[salesmanCode];
                   if (typeof subIndiv === 'number') {
                     subTarget = subIndiv;
                   } else if (typeof subIndiv === 'string' && subIndiv.trim() !== '' && !isNaN(Number(subIndiv))) {
                     subTarget = Number(subIndiv);
                   } else if (typeof subIndiv === 'object' && subIndiv !== null) {
                     if (subIndiv[monthToFetch] !== undefined && subIndiv[monthToFetch] !== null && String(subIndiv[monthToFetch]).trim() !== '') {
                       subTarget = Number(subIndiv[monthToFetch]) || 0;
                     } else if (subIndiv['flat'] !== undefined && subIndiv['flat'] !== null && String(subIndiv['flat']).trim() !== '') {
                       subTarget = Number(subIndiv['flat']) || 0;
                     }
                   } else if (subGroup.targetValue !== undefined && subGroup.targetValue !== null && String(subGroup.targetValue).trim() !== '') {
                     subTarget = Number(subGroup.targetValue) || 0;
                   }

                   const sAch = subAch[subGroup.id] || { stt: 0, uba: 0 };
                   const subAchieved = group.targetType === 'STT' ? sAch.stt : sAch.uba;
                   const subHit = subTarget > 0 && subAchieved >= subTarget;

                   return {
                     ...subGroup,
                     actualSTT: sAch.stt,
                     actualUBA: sAch.uba,
                     targetValue: subTarget,
                     isHit: subHit
                   };
                 });
               }

               // Determine target for this salesman
               let targetValue = 0;
               const indivTargetData = group.individualTargets && group.individualTargets[salesmanCode];
               
               if (group.definitionType === 'new_customer') {
                  targetValue = latestMetricsData[salesmanCode]?.new_customer_count || 0;
               } else if (typeof indivTargetData === 'number') {
                  targetValue = indivTargetData;
               } else if (typeof indivTargetData === 'string' && indivTargetData.trim() !== '' && !isNaN(Number(indivTargetData))) {
                  targetValue = Number(indivTargetData);
               } else if (typeof indivTargetData === 'object' && indivTargetData !== null) {
                  if (indivTargetData[monthToFetch] !== undefined && indivTargetData[monthToFetch] !== null && String(indivTargetData[monthToFetch]).trim() !== '') {
                     targetValue = Number(indivTargetData[monthToFetch]) || 0;
                  } else if (indivTargetData['flat'] !== undefined && indivTargetData['flat'] !== null && String(indivTargetData['flat']).trim() !== '') {
                     targetValue = Number(indivTargetData['flat']) || 0;
                  }
               }

               // Fallbacks if no explicit individual target was set for parent group:
               if (targetValue === 0 && group.hasSubGroups && subGroupsList.length > 0) {
                  targetValue = subGroupsList.reduce((acc: number, sub: any) => acc + (sub.targetValue || 0), 0);
               } else if (targetValue === 0 && group.targetValue !== undefined && group.targetValue !== null && String(group.targetValue).trim() !== '') {
                  targetValue = Number(group.targetValue) || 0;
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
                  isHit,
                  subGroupsList
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
