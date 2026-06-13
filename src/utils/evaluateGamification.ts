import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

// Evaluates the given week for all salesmen and awards points.
// This should be triggered when we detect that the current week has advanced, 
// and the previous week has not yet been evaluated.
export const evaluateGamification = async (
  monthKey: string,
  weekToEvaluate: number,
  salesmenData: any[],
  weeklyCommitments: any,
  usersCache: any[],
  force: boolean = false
) => {
  try {
    const medalsRef = doc(db, 'historical_medals', monthKey);
    const medalsSnap = await getDoc(medalsRef);
    const medalsData = medalsSnap.exists() ? medalsSnap.data() : { evaluatedWeeks: [] };

    // Prevent double evaluation
    if (!force && medalsData.evaluatedWeeks && medalsData.evaluatedWeeks.includes(weekToEvaluate)) {
      return;
    }

    const batch = writeBatch(db);
    const newMedals: any = { ...medalsData };
    if (!newMedals.evaluatedWeeks) newMedals.evaluatedWeeks = [];
    newMedals.evaluatedWeeks.push(weekToEvaluate);

    const metrics = ['stt', 'uba', 'vd30'];
    const weekSnapshots: Record<string, any> = {};

    metrics.forEach(metric => {
      // 1. Filter eligible salesmen for this metric
      const eligibleSalesmen = salesmenData.filter(s => {
        const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
        if (!supervisor) return false;

        const teamCommitments = weeklyCommitments[supervisor.uid];
        if (!teamCommitments || !teamCommitments[metric] || !teamCommitments[metric][weekToEvaluate.toString()]) {
          return false;
        }
        
        const weekData = teamCommitments[metric][weekToEvaluate.toString()];
        if (weekData.status !== 'approved') return false;

        let target = weekData.target;
        if (weekData.overrides) {
          Object.values(weekData.overrides).forEach((overrideGrp: any) => {
            if (overrideGrp.salesmen && overrideGrp.salesmen.includes(s.id)) {
              target = overrideGrp.target;
            }
          });
        }

        const actualVal = metric === 'stt' ? (s.mtdSales / (s.target || 1)) * 100 :
                          metric === 'uba' ? s.uba :
                                             s.vd30;

        return actualVal >= target;
      });

      // 2. Sort and Award per Service Model
      const types = ['Ex-Truck', 'Booking'];
      types.forEach(type => {
        const typeSalesmen = eligibleSalesmen.filter(s => s.type === type).map(s => {
          const actualVal = metric === 'stt' ? (s.mtdSales / (s.target || 1)) * 100 :
                            metric === 'uba' ? s.uba :
                                               s.vd30;
                                               
          // Get target
          const supervisor = usersCache.find(u => u.role === 'supervisor' && u.team && u.team.includes(s.team));
          const commitments = supervisor ? weeklyCommitments[supervisor.uid] : null;
          const target = commitments?.[metric]?.[weekToEvaluate.toString()]?.target || 0;
          
          return { ...s, actualVal, metTarget: actualVal >= target };
        }).sort((a, b) => b.actualVal - a.actualVal);

        let medalRank = 0;
        typeSalesmen.forEach((s, idx) => {
          const id = s.id;
          if (!weekSnapshots[id]) {
            weekSnapshots[id] = { gold: 0, silver: 0, bronze: 0, points: 0, metrics: {} };
          }
          
          let medal = 'none';
          let points = 0;
          
          if (s.metTarget) {
            if (medalRank === 0) { medal = 'gold'; points = 5; weekSnapshots[id].gold += 1; }
            else if (medalRank === 1) { medal = 'silver'; points = 3; weekSnapshots[id].silver += 1; }
            else if (medalRank === 2) { medal = 'bronze'; points = 1; weekSnapshots[id].bronze += 1; }
            medalRank++;
          }
          
          weekSnapshots[id].points += points;
          weekSnapshots[id].metrics[metric] = {
            medal,
            points,
            rank: idx + 1,
            actualPct: s.actualVal
          };
        });
      });
    });

    batch.set(medalsRef, newMedals, { merge: true });

    // Update achievements doc for the month
    const achRef = doc(db, 'achievements', monthKey);
    const achSnap = await getDoc(achRef);
    const achData = achSnap.exists() ? achSnap.data() : { weekly_medals: {} };
    
    if (!achData.weekly_medals) achData.weekly_medals = {};
    
    // Completely overwrite this week's snapshot
    achData.weekly_medals[weekToEvaluate] = weekSnapshots;

    batch.set(achRef, achData, { merge: true });

    await batch.commit();
    console.log(`Successfully evaluated Gamification for Week ${weekToEvaluate}`);

  } catch (err) {
    console.error("Error evaluating gamification:", err);
  }
};
