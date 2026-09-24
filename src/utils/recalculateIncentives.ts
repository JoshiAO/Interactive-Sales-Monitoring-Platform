import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export const recalculateIncentiveAchievements = async (
  onProgress?: (step: string, current: number, total: number) => void
) => {
  try {
    if (onProgress) onProgress('Fetching active incentive programs...', 10, 100);

    // 1. Fetch Active & Draft Incentive Programs
    const incProgramsQuery = query(collection(db, 'incentives_programs'), where('status', 'in', ['active', 'draft']));
    const incProgramsSnap = await getDocs(incProgramsQuery);
    const activeIncentives: any[] = [];
    incProgramsSnap.forEach(docSnap => {
      activeIncentives.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (activeIncentives.length === 0) {
      if (onProgress) onProgress('No active incentive programs found.', 100, 100);
      return;
    }

    // 2. Fetch channel mappings
    const channelSnap = await getDoc(doc(db, 'reference_channels', 'all'));
    const channelMap: Record<string, string> = {};
    if (channelSnap.exists()) {
      Object.values(channelSnap.data()).forEach((r: any) => {
        const baseChannel = r['Channel'] || r.channel;
        const classification = r['Channel_Classification'] || r['Channel Classification'];
        if (baseChannel && classification) {
          channelMap[String(classification).trim().toLowerCase()] = String(baseChannel).trim();
        }
      });
    }

    // 3. Fetch New Customer assignments
    const allCustSnapForIncentives = await getDocs(collection(db, 'customer_data'));
    const newCustomersSet = new Set<string>();
    allCustSnapForIncentives.forEach(d => {
      const data = d.data();
      if (data.customers) {
        try {
          const parsed = JSON.parse(data.customers);
          parsed.forEach((c: any) => {
            const isNew = String(c['NEW CUSTOMER'] || '').trim().toUpperCase() === 'YES';
            if (isNew) {
              newCustomersSet.add(String(c['CUSTOMER CODE']).replace(/[^a-zA-Z0-9_]/g, ''));
            }
          });
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    // 4. Fetch main metrics document
    if (onProgress) onProgress('Fetching dashboard metrics...', 30, 100);
    const metricsSnap = await getDoc(doc(db, 'dashboard_metrics', 'all'));
    if (!metricsSnap.exists()) {
      if (onProgress) onProgress('No dashboard metrics found. Please upload Net Invoiced data.', 100, 100);
      return;
    }

    const allMetricsDoc = { ...metricsSnap.data() };
    const normalizeCode = (c: any) => String(c || '').trim().toLowerCase().replace(/^0+/, '');

    // 5. Evaluate achievements for each salesman from customer_data
    if (onProgress) onProgress('Re-evaluating actual achievements...', 50, 100);

    allCustSnapForIncentives.forEach(d => {
      const salesmanCode = d.id;
      if (!allMetricsDoc[salesmanCode]) return;
      const m = allMetricsDoc[salesmanCode];
      if (!m.incentives) m.incentives = {};

      const data = d.data();
      if (!data.customers) return;

      let parsedCustomers: any[] = [];
      try {
        parsedCustomers = JSON.parse(data.customers);
      } catch (e) {
        return;
      }

      activeIncentives.forEach(prog => {
        if (!m.incentives[prog.id]) m.incentives[prog.id] = {};

        Object.values(prog.trackingGroups || {}).forEach((group: any) => {
          if (!m.incentives[prog.id][group.id]) {
            m.incentives[prog.id][group.id] = { stt: 0, uba_customers: new Set<string>(), subGroups: {} };
          } else {
            // Reset calculations for fresh recalculation
            m.incentives[prog.id][group.id].stt = 0;
            m.incentives[prog.id][group.id].uba_customers = new Set<string>();
            if (group.hasSubGroups && group.subGroups) {
              if (!m.incentives[prog.id][group.id].subGroups) m.incentives[prog.id][group.id].subGroups = {};
              Object.keys(group.subGroups).forEach((subId: string) => {
                m.incentives[prog.id][group.id].subGroups[subId] = { stt: 0, uba_customers: new Set<string>() };
              });
            }
          }

          const gState = m.incentives[prog.id][group.id];

          parsedCustomers.forEach((c: any) => {
            const custNum = String(c['CUSTOMER CODE'] || '').replace(/[^a-zA-Z0-9_]/g, '');
            const rawChannel = String(c['CHANNEL'] || c['Channel'] || c['PARTY CLASSIFICATION DESCRIPTION'] || 'Uncategorized').trim();
            const channel = channelMap[rawChannel.toLowerCase()] || rawChannel;

            // Channel filter check
            if (group.channels && group.channels.length > 0) {
              const isAll = group.channels.some((ch: string) => ch.toLowerCase() === 'all' || ch.toLowerCase().includes('all channels'));
              if (!isAll && !group.channels.some((ch: string) => ch.toLowerCase() === channel.toLowerCase())) {
                return;
              }
            }

            const productSales = c.product_sales || {};
            Object.keys(productSales).forEach((prodCode: string) => {
              const pSale = productSales[prodCode];
              const netVal = pSale?.netValue || 0;
              if (netVal <= 0) return;

              let isMatch = false;

              if (group.hasSubGroups && group.subGroups) {
                Object.values(group.subGroups).forEach((sub: any) => {
                  if (!gState.subGroups[sub.id]) {
                    gState.subGroups[sub.id] = { stt: 0, uba_customers: new Set<string>() };
                  }
                  const subState = gState.subGroups[sub.id];
                  if (sub.items && sub.items.some((item: any) => normalizeCode(item) === normalizeCode(prodCode))) {
                    isMatch = true;
                    subState.stt += netVal;
                    if (custNum && netVal >= (group.minDropSize || 0)) {
                      subState.uba_customers.add(custNum);
                    }
                  }
                });
              } else if (group.definitionType === 'new_customer') {
                if (custNum && newCustomersSet.has(custNum)) isMatch = true;
              } else if (group.definitionType === 'category') {
                const catName = c.category || c.Category;
                if (group.items && group.items.some((item: any) => String(item).trim().toLowerCase() === String(catName || '').trim().toLowerCase())) {
                  isMatch = true;
                }
              } else if (group.definitionType === 'products') {
                if (group.items && group.items.some((item: any) => normalizeCode(item) === normalizeCode(prodCode))) {
                  isMatch = true;
                }
              }

              if (isMatch) {
                gState.stt += netVal;
                if (custNum && netVal >= (group.minDropSize || 0)) {
                  gState.uba_customers.add(custNum);
                }
              }
            });
          });
        });
      });
    });

    // 6. Serialize sets to arrays/counts for Firestore storage
    if (onProgress) onProgress('Saving updated achievements to database...', 80, 100);

    const summaryMetricsDoc: Record<string, any> = {};
    Object.keys(allMetricsDoc).forEach(code => {
      const m = allMetricsDoc[code];
      const finalIncentives: Record<string, any> = {};

      if (m.incentives) {
        Object.keys(m.incentives).forEach(progId => {
          finalIncentives[progId] = {};
          Object.keys(m.incentives[progId]).forEach(groupId => {
            const gState = m.incentives[progId][groupId];
            const ubaCustSet = gState.uba_customers instanceof Set ? gState.uba_customers : new Set(gState.uba_customers || []);
            const subGroupsSerialized: Record<string, any> = {};

            if (gState.subGroups) {
              Object.keys(gState.subGroups).forEach(subId => {
                const sState = gState.subGroups[subId];
                const sSet = sState.uba_customers instanceof Set ? sState.uba_customers : new Set(sState.uba_customers || []);
                subGroupsSerialized[subId] = {
                  stt: sState.stt,
                  uba: sSet.size
                };
              });
            }

            finalIncentives[progId][groupId] = {
              stt: gState.stt,
              uba: ubaCustSet.size,
              uba_customers: Array.from(ubaCustSet),
              ...(Object.keys(subGroupsSerialized).length > 0 ? { subGroups: subGroupsSerialized } : {})
            };
          });
        });
      }

      m.incentives = finalIncentives;

      summaryMetricsDoc[code] = {
        salesman_code: m.salesman_code,
        salesman_name: m.salesman_name,
        mtd_net_value: m.mtd_net_value,
        mtd_volume: m.mtd_volume,
        uba: m.uba,
        cml_count: m.cml_count || 0,
        new_customer_count: m.new_customer_count || 0,
        frequency: m.frequency || { f1: 0, f2: 0, f3: 0, f4: 0 },
        vd30_placements: m.vd30_placements,
        incentives: finalIncentives,
        last_updated: new Date().toISOString()
      };
    });

    // Save to Firestore
    await setDoc(doc(db, 'dashboard_metrics', 'all'), allMetricsDoc, { merge: true });
    await setDoc(doc(db, 'dashboard_metrics_summary', 'all'), summaryMetricsDoc, { merge: true });

    if (onProgress) onProgress('Recalculation complete!', 100, 100);
  } catch (err: any) {
    console.error('Failed to recalculate incentive achievements:', err);
    if (onProgress) onProgress(`Error: ${err.message || 'Failed to recalculate'}`, 100, 100);
    throw err;
  }
};
