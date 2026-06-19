import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const uploadGroups = [
  {
    name: 'Transactional Data',
    items: ['Net Invoiced', 'Ageing Report', 'Warehouse B.O.', 'Van B.O.', 'CML (Customer Master List)']
  },
  {
    name: 'Targets',
    items: ['STT & UBA Target', 'VD30 Target']
  },
  {
    name: 'References',
    items: [
      'Item Masterlist', 
      'Channel Reference', 
      'VD30 Items Reference', 
      'Geo Hierarchy Reference', 
      'Team & Service Model Reference', 
      'NPD & Promo Pack Items', 
      'Pricelist',
      'Product ADS Reference'
    ]
  }
];

interface AggregatedMetrics {
  salesman_code: string;
  salesman_name: string;
  mtd_net_value: number;
  mtd_volume: number;
  gsr: number;
  bsr: number;
  uba_customers: Set<string>;
  vd30_placements: Record<string, Set<string>>;
  vd30_product_details: Record<string, { customers: Set<string>; volume: number }>;
  categories: Record<string, number>;
  channels: Record<string, number>;
  brgy: Record<string, number>;
  town: Record<string, number>;
  customer_weekly_net: Record<string, Record<string, number>>;
}

const parseExcelWithSmartHeaders = (worksheet: XLSX.WorkSheet) => {
  // Convert sheet to array of arrays to find the real header row
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  let headerRowIndex = 0;
  // Look for a row that contains known keywords
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const row = rawData[i] as any[];
    if (!row) continue;
    const rowStr = row.join(' ').toLowerCase();
    if (rowStr.includes('date') || rowStr.includes('customer code') || rowStr.includes('salesman_code') || rowStr.includes('category') || rowStr.includes('province') || rowStr.includes('product code')) {
      headerRowIndex = i;
      break;
    }
  }

  // Parse properly using the found header row
  const headers = rawData[headerRowIndex] as string[];
  const dataRows = rawData.slice(headerRowIndex + 1);
  
  const parsed = dataRows.map((row: any) => {
    let obj: any = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  }).filter((o: any) => Object.keys(o).length > 0);

  return parsed;
};

const DATE_PICKER_CATEGORIES = ['Net Invoiced', 'Ageing Report', 'Warehouse B.O.', 'Van B.O.'];

const DataUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(uploadGroups[0].items[0]);
  const [uploading, setUploading] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [progress, setProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cobDate, setCobDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [systemAnnouncement, setSystemAnnouncement] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  // Fetch current announcement on mount
  React.useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'global'));
      if (docSnap.exists() && docSnap.data().systemAnnouncement) {
        setSystemAnnouncement(docSnap.data().systemAnnouncement);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), { systemAnnouncement }, { merge: true });
      alert("System announcement updated successfully!");
    } catch (e: any) {
      console.error(e);
      alert("Failed to update announcement: " + e.message);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const processAndUpload = async (file: File, category: string) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          setProgress({ step: 'Parsing Excel file...', current: 0, total: 100 });
          const json = parseExcelWithSmartHeaders(worksheet);

          if (json.length === 0) {
            throw new Error("Excel file is empty or headers could not be detected.");
          }

          // === BROWSER-SIDE AGGREGATION LOGIC (For Net Invoiced & CML) ===
          if (category === 'Net Invoiced') {
            setProgress({ step: 'Aggregating Metrics...', current: 0, total: 100 });
            
            // 1. Fetch reference_vd30 to map products to VD30 buckets
            const vd30Snap = await getDocs(collection(db, 'reference_vd30'));
            const vd30Map: Record<string, string> = {};
            const metrics: Record<string, AggregatedMetrics> = {};
            
            const vd30Buckets = new Set<string>();
            vd30Snap.forEach(d => {
              const r = d.data();
              if (r.product_code && r.vd30_code) {
                vd30Map[String(r.product_code)] = r.vd30_code;
                vd30Buckets.add(r.vd30_code);
              }
            });

            // 2. Aggregate Data
            const customerMetrics: Record<string, any> = {};

            json.forEach((row: any) => {
              const salesmanCode = row['Employee Code'];
              if (!salesmanCode) return;

              if (!metrics[salesmanCode]) {
                metrics[salesmanCode] = {
                  salesman_code: salesmanCode,
                  salesman_name: row['Employee Name'] || '',
                  mtd_net_value: 0,
                  mtd_volume: 0,
                  gsr: 0,
                  bsr: 0,
                  uba_customers: new Set<string>(),
                  vd30_placements: {},
                  vd30_product_details: {} as Record<string, { customers: Set<string>; volume: number }>,
                  categories: {},
                  channels: {},
                  brgy: {},
                  town: {},
                  customer_weekly_net: {}
                };
              }

              const m = metrics[salesmanCode];
              const netValue = parseFloat(row['Net Value']) || 0;
              const volume = parseFloat(row['Volume']) || 0;
              const gsr = parseFloat(row['Good Stock Returns']) || 0;
              const bsr = parseFloat(row['Bad Stock Returns']) || 0;
              const custNum = row['Sold To Customer number'];
              const prodCode = row['Product Code'];
              const category = row['Category'] || 'Uncategorized';
              const channel = row['Channel_Classification'] || row['Channel'] || 'Uncategorized';
              const brgy = row['Brgy'] || 'Unknown';
              const town = row['Town'] || 'Unknown';
              const week = row['Week'];

              m.mtd_net_value += netValue;
              m.mtd_volume += volume;
              m.gsr += gsr;
              m.bsr += bsr;
              
              if (custNum) {
                const cNumStr = String(custNum).replace(/[^a-zA-Z0-9_]/g, '');
                m.uba_customers.add(cNumStr); // Track all customers seen for this salesman

                if (!customerMetrics[cNumStr]) {
                  customerMetrics[cNumStr] = { volume: 0, netValue: 0, gsr: 0, bsr: 0, isBuying: false, bsr_products: {}, bsr_categories: {} };
                }
                customerMetrics[cNumStr].volume += volume;
                customerMetrics[cNumStr].netValue += netValue;
                customerMetrics[cNumStr].gsr += gsr;
                customerMetrics[cNumStr].bsr += bsr;

                if (bsr > 0 && prodCode) {
                  const pCode = String(prodCode);
                  customerMetrics[cNumStr].bsr_products[pCode] = (customerMetrics[cNumStr].bsr_products[pCode] || 0) + bsr;
                  customerMetrics[cNumStr].bsr_categories[category] = (customerMetrics[cNumStr].bsr_categories[category] || 0) + bsr;
                }
              }
              
              m.categories[category] = (m.categories[category] || 0) + netValue;
              m.channels[channel] = (m.channels[channel] || 0) + netValue;
              m.brgy[brgy] = (m.brgy[brgy] || 0) + netValue;
              m.town[town] = (m.town[town] || 0) + netValue;

              // UBA Condition (Net Value >= 1) - Kept only for VD30 placements now
              if (netValue >= 1 && custNum) {
                const vd30Bucket = vd30Map[String(prodCode)];
                if (vd30Bucket) {
                  // VD30 is only for Sari-Sari Stores
                  const channelLower = channel.toLowerCase();
                  const isSariSari = channelLower.includes('sari-sari') || channelLower.includes('sari sari');
                  
                  if (isSariSari) {
                    if (!m.vd30_placements[vd30Bucket]) {
                      m.vd30_placements[vd30Bucket] = new Set<string>();
                    }
                    m.vd30_placements[vd30Bucket].add(String(custNum));

                    // Per-product detail tracking (Option B)
                    const prodKey = String(prodCode);
                    if (!m.vd30_product_details[prodKey]) {
                      m.vd30_product_details[prodKey] = { customers: new Set<string>(), volume: 0 };
                    }
                    m.vd30_product_details[prodKey].customers.add(String(custNum));
                    m.vd30_product_details[prodKey].volume += volume;
                  }
                }
              }

              if (custNum && week) {
                const cNumStr = String(custNum).replace(/[^a-zA-Z0-9_]/g, '');
                if (!m.customer_weekly_net[cNumStr]) {
                  m.customer_weekly_net[cNumStr] = {};
                }
                m.customer_weekly_net[cNumStr][week] = (m.customer_weekly_net[cNumStr][week] || 0) + netValue;
              }
            });

            // 3. Save Aggregated Metrics to Firestore
            setProgress({ step: 'Updating Customer Performances...', current: 50, total: 100 });
            
            const allCustSnap = await getDocs(collection(db, 'customer_data'));
            const chunkBatch = writeBatch(db);
            
            allCustSnap.forEach(d => {
              const data = d.data();
              if (!data.customers) return;
              
              const parsedCustomers = JSON.parse(data.customers);
              
              parsedCustomers.forEach((c: any) => {
                const safeId = String(c['CUSTOMER CODE']).replace(/[^a-zA-Z0-9_]/g, '');
                const metrics = customerMetrics[safeId];
                
                if (metrics) {
                   c.volume = metrics.volume;
                   c.netValue = metrics.netValue;
                   c.gsr = metrics.gsr;
                   c.bsr = metrics.bsr;
                   c.isBuying = metrics.netValue >= 1;
                   if (Object.keys(metrics.bsr_products).length > 0) c.bsr_products = metrics.bsr_products;
                   if (Object.keys(metrics.bsr_categories).length > 0) c.bsr_categories = metrics.bsr_categories;
                } else {
                   c.volume = 0;
                   c.netValue = 0;
                   c.gsr = 0;
                   c.bsr = 0;
                   c.isBuying = false;
                   delete c.bsr_products;
                   delete c.bsr_categories;
                }
              });
              
              chunkBatch.set(d.ref, { customers: JSON.stringify(parsedCustomers) }, { merge: true });
            });
            
            await chunkBatch.commit();

            setProgress({ step: 'Saving Aggregated Dashboards...', current: 80, total: 100 });
            // Read existing metrics to preserve cml_count (set by CML upload)
            const existingMetricsSnap = await getDoc(doc(db, 'dashboard_metrics', 'all'));
            const existingMetricsAll = existingMetricsSnap.exists() ? existingMetricsSnap.data() : {};

            const allMetricsDoc: Record<string, any> = {};
            Object.keys(metrics).forEach(salesmanCode => {
              const m = metrics[salesmanCode];
              const finalVd30: Record<string, number> = {};
              
              // Initialize all possible VD30 buckets to 0 to overwrite any ghost data
              vd30Buckets.forEach(bucket => {
                finalVd30[bucket] = 0;
              });

              Object.keys(m.vd30_placements).forEach(bucket => {
                finalVd30[bucket] = m.vd30_placements[bucket].size;
              });

              // Calculate Frequency F1-F4 and final UBA
              let f1 = 0, f2 = 0, f3 = 0, f4 = 0;
              let finalUba = 0;

              m.uba_customers.forEach((custId: string) => {
                const cMet = customerMetrics[custId];
                // Only count as UBA and Frequency if their total month netValue >= 1
                if (cMet && cMet.netValue >= 1) {
                  finalUba++;
                  let activeWeeks = 0;
                  const weeklyData = m.customer_weekly_net[custId] || {};
                  Object.values(weeklyData).forEach((weekNet: any) => {
                    if (weekNet >= 1) activeWeeks++;
                  });
                  
                  // Ensure they fall into at least F1 if they are UBA
                  if (activeWeeks === 0) activeWeeks = 1;

                  if (activeWeeks === 1) f1++;
                  else if (activeWeeks === 2) f2++;
                  else if (activeWeeks === 3) f3++;
                  else if (activeWeeks >= 4) f4++;
                }
              });

              // Preserve cml_count from existing data (set by CML upload)
              const existingCml = existingMetricsAll[salesmanCode]?.cml_count;

              // Serialize per-product VD30 details compactly: { product_code: { customers: count, volume: num } }
              const finalVd30Products: Record<string, { customers: number; volume: number }> = {};
              Object.keys(m.vd30_product_details).forEach(prodCode => {
                const detail = m.vd30_product_details[prodCode];
                finalVd30Products[prodCode] = {
                  customers: detail.customers.size,
                  volume: detail.volume
                };
              });

              allMetricsDoc[salesmanCode] = {
                salesman_code: m.salesman_code,
                salesman_name: m.salesman_name,
                mtd_net_value: m.mtd_net_value,
                mtd_volume: m.mtd_volume,
                gsr: m.gsr,
                bsr: m.bsr,
                uba: finalUba,
                vd30_placements: finalVd30,
                vd30_product_details: finalVd30Products,
                categories: m.categories,
                channels: m.channels,
                brgy: m.brgy,
                town: m.town,
                frequency: { f1, f2, f3, f4 },
                ...(existingCml !== undefined ? { cml_count: existingCml } : {}),
                last_updated: new Date().toISOString()
              };
            });

            await setDoc(doc(db, 'dashboard_metrics', 'all'), allMetricsDoc, { merge: true });
            
            // Save COB Date globally
            await setDoc(doc(db, 'settings', 'global'), { cobDate, lastDataUpload: Date.now() }, { merge: true });

            // --- DAILY ACHIEVEMENTS STACKING ---
            setProgress({ step: 'Calculating Daily Achievements...', current: 90, total: 100 });
            try {
              // 1. Fetch all necessary data
              const [metricsSnap, sttSnap, vd30Snap, usersSnap, settingsSnap] = await Promise.all([
                getDoc(doc(db, 'dashboard_metrics', 'all')),
                getDoc(doc(db, 'salesman_targets', 'all')),
                getDoc(doc(db, 'vd30_targets', 'all')),
                getDocs(collection(db, 'users')),
                getDoc(doc(db, 'settings', 'performance_panel'))
              ]);

              const userTypes: Record<string, string> = {};
              usersSnap.forEach((u: any) => {
                 const data = u.data();
                 if (data.salesmanId && data.salesmanType) userTypes[String(data.salesmanId)] = data.salesmanType;
              });

              const excludedSalesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_salesmen || []) : [];
              const excludedVd30Salesmen = settingsSnap.exists() ? (settingsSnap.data().excluded_vd30_salesmen || []) : [];

              // Map targets
              const targetsMap: Record<string, { target: number, ubaTarget: number, vd30TargetMap: Record<string, number> }> = {};
              const sttRaw = sttSnap.exists() ? sttSnap.data() : {};
              Object.keys(sttRaw).forEach(k => {
                 const d = sttRaw[k];
                 targetsMap[k] = { target: parseFloat(d.stt_target) || 0, ubaTarget: parseFloat(d['uba target']) || 0, vd30TargetMap: {} };
              });
              
              const vd30Raw = vd30Snap.exists() ? vd30Snap.data() : {};
              Object.keys(vd30Raw).forEach(k => {
                 const d = vd30Raw[k];
                 if (!targetsMap[k]) targetsMap[k] = { target: 0, ubaTarget: 0, vd30TargetMap: {} };
                 Object.keys(d).forEach(field => {
                   if (field.startsWith('F')) {
                     targetsMap[k].vd30TargetMap[field] = parseFloat(d[field]) || 0;
                   }
                 });
              });

              // Map metrics and calculate VD30 hits
              const salesmenRankingData: any[] = [];
              const metricsRaw = metricsSnap.exists() ? metricsSnap.data() : {};
              
              Object.keys(metricsRaw).forEach(sId => {
                 const d = metricsRaw[sId];
                 const type = userTypes[sId];
                 if (!type) return; // EXCLUDE UNASSIGNED

                 const targetInfo = targetsMap[sId] || { target: 0, ubaTarget: 0, vd30TargetMap: {} };
                 
                 let vd30HitCount = 0;
                 let vd30TargetCount = 0;
                 Object.keys(targetInfo.vd30TargetMap).forEach(field => {
                    const tgt = targetInfo.vd30TargetMap[field];
                    if (tgt > 0) {
                      vd30TargetCount++;
                      const act = (d.vd30_placements && d.vd30_placements[field]) || 0;
                      if (act >= tgt) vd30HitCount++;
                    }
                 });

                 salesmenRankingData.push({
                   id: sId,
                   type: type,
                   mtdSales: d.mtd_net_value || 0,
                   target: targetInfo.target || 1,
                   uba: d.uba || 0,
                   ubaTarget: targetInfo.ubaTarget || 1,
                   vd30: vd30HitCount,
                   vd30Target: vd30TargetCount || 1
                 });
              });

              // Helper to assign medals
              const dailyPointsMap: Record<string, any> = {};
              
              // Pre-populate with indices
              salesmenRankingData.forEach(s => {
                 dailyPointsMap[s.id] = {
                    gold: 0, silver: 0, bronze: 0, points: 0,
                    metrics: {
                       stt: { medal: 'none', index: s.target > 0 ? (s.mtdSales / s.target) * 100 : 0 },
                       uba: { medal: 'none', index: s.ubaTarget > 0 ? (s.uba / s.ubaTarget) * 100 : 0 },
                       vd30: { medal: 'none', index: s.vd30Target > 0 ? (s.vd30 / s.vd30Target) * 100 : 0 }
                    }
                 };
              });

              const assignMedals = (sortedList: any[], metricKey: 'stt' | 'uba' | 'vd30') => {
                [5, 3, 1].forEach((points, idx) => {
                  if (sortedList[idx]) {
                    const id = sortedList[idx].id;
                    if (!dailyPointsMap[id]) return;
                    
                    dailyPointsMap[id].points += points;
                    
                    let medalType = 'none';
                    if (points === 5) { dailyPointsMap[id].gold += 1; medalType = 'gold'; }
                    else if (points === 3) { dailyPointsMap[id].silver += 1; medalType = 'silver'; }
                    else if (points === 1) { dailyPointsMap[id].bronze += 1; medalType = 'bronze'; }
                    
                    dailyPointsMap[id].metrics[metricKey].medal = medalType;
                  }
                });
              };

              // Calculate per service model separately
              ['Ex-Truck', 'Booking'].forEach(serviceModel => {
                  const filtered = salesmenRankingData.filter(s => s.type === serviceModel);
                  
                  const sttSorted = [...filtered]
                    .filter(s => !excludedSalesmen.includes(s.id) && s.mtdSales > 0)
                    .sort((a, b) => (b.mtdSales / b.target) - (a.mtdSales / a.target));
                    
                  const ubaSorted = [...filtered]
                    .filter(s => !excludedSalesmen.includes(s.id) && s.uba > 0)
                    .sort((a, b) => (b.uba / b.ubaTarget) - (a.uba / a.ubaTarget));
                    
                  const vd30Sorted = [...filtered]
                    .filter(s => !excludedVd30Salesmen.includes(s.id) && s.vd30 > 0)
                    .sort((a, b) => (b.vd30 / b.vd30Target) - (a.vd30 / a.vd30Target));

                  assignMedals(sttSorted, 'stt');
                  assignMedals(ubaSorted, 'uba');
                  assignMedals(vd30Sorted, 'vd30');
              });

              // Save to Firestore achievements/YYYY-MM
              const monthKey = cobDate.substring(0, 7); // e.g. "2026-06"
              const achRef = doc(db, 'achievements', monthKey);
              
              await setDoc(achRef, {
                daily_points: {
                  [cobDate]: dailyPointsMap
                },
                last_updated: new Date().toISOString()
              }, { merge: true });

            } catch (err) {
              console.error("Error calculating daily achievements:", err);
            }

            // --- NPD & PROMO PACK AGGREGATION ---
            setProgress({ step: 'Aggregating NPD & Promo Pack Metrics...', current: 95, total: 100 });
            try {
              const npdItemsSnap = await getDocs(collection(db, 'npd_promopack_items'));
              const npdItemMap: Record<string, { product_description: string; type: string; category: string }> = {};
              npdItemsSnap.forEach(d => {
                const r = d.data();
                const pCode = r.product_code || r['Product Code'] || d.id;
                if (pCode) {
                  npdItemMap[String(pCode)] = {
                    product_description: r.product_description || r['Product Description'] || r.description || r['product description'] || '',
                    type: r.type || r['Type'] || 'NPD',
                    category: r.category || r['Category'] || ''
                  };
                }
              });

              if (Object.keys(npdItemMap).length > 0) {
                // Fetch user names for salesman
                const usersSnapNpd = await getDocs(collection(db, 'users'));
                const userNamesNpd: Record<string, string> = {};
                usersSnapNpd.forEach(d => {
                  const u = d.data();
                  if (u.salesmanId && u.name) userNamesNpd[String(u.salesmanId)] = u.name;
                });

                // Aggregate NPD/Promo per product
                const npdMetrics: Record<string, { stt: number; volume: number; customersMap: Record<string, number>; salesmen: Record<string, { name: string; stt: number; volume: number; customersMap: Record<string, { name: string; stt: number }> }> }> = {};

                // Pre-populate all items so they appear even with 0 sales
                Object.keys(npdItemMap).forEach(prodCode => {
                  npdMetrics[prodCode] = { stt: 0, volume: 0, customersMap: {}, salesmen: {} };
                });

                json.forEach((row: any) => {
                  const prodCode = String(row['Product Code'] || '');
                  if (!npdItemMap[prodCode]) return;
                  const netValue = parseFloat(row['Net Value']) || 0;
                  const volume = parseFloat(row['Volume']) || 0;
                  const custNum = row['Sold To Customer number'] ? String(row['Sold To Customer number']).replace(/[^a-zA-Z0-9_]/g, '') : '';
                  const custName = row['Sold-to Customer Name'] || row['Sold To Customer Name'] || custNum;
                  const salesmanCode = String(row['Employee Code'] || '');
                  const salesmanName = row['Employee Name'] || userNamesNpd[salesmanCode] || salesmanCode;

                  if (!npdMetrics[prodCode]) npdMetrics[prodCode] = { stt: 0, volume: 0, customersMap: {}, salesmen: {} };
                  npdMetrics[prodCode].stt += netValue;
                  npdMetrics[prodCode].volume += volume;
                  
                  if (custNum) {
                    npdMetrics[prodCode].customersMap[custNum] = (npdMetrics[prodCode].customersMap[custNum] || 0) + netValue;
                  }

                  if (salesmanCode) {
                    if (!npdMetrics[prodCode].salesmen[salesmanCode]) {
                      npdMetrics[prodCode].salesmen[salesmanCode] = { name: salesmanName, stt: 0, volume: 0, customersMap: {} };
                    }
                    npdMetrics[prodCode].salesmen[salesmanCode].stt += netValue;
                    npdMetrics[prodCode].salesmen[salesmanCode].volume += volume;
                    
                    if (custNum && netValue !== 0) {
                      if (!npdMetrics[prodCode].salesmen[salesmanCode].customersMap[custNum]) {
                        npdMetrics[prodCode].salesmen[salesmanCode].customersMap[custNum] = { name: custName, stt: 0 };
                      }
                      npdMetrics[prodCode].salesmen[salesmanCode].customersMap[custNum].stt += netValue;
                    }
                  }
                });

                // Write to Firestore
                const npdBatch = writeBatch(db);
                Object.keys(npdMetrics).forEach(prodCode => {
                  const m = npdMetrics[prodCode];
                  const info = npdItemMap[prodCode];
                  
                  let productUba = 0;
                  Object.values(m.customersMap).forEach(cStt => {
                    if (cStt >= 1) productUba++;
                  });

                  const salesmenArr = Object.keys(m.salesmen).map(code => {
                    let smUba = 0;
                    const smCustomers = Object.keys(m.salesmen[code].customersMap).map(cCode => {
                      const c = m.salesmen[code].customersMap[cCode];
                      const uba = c.stt >= 1 ? 1 : 0;
                      if (uba) smUba++;
                      return {
                        code: cCode,
                        name: c.name,
                        stt: c.stt,
                        uba: uba
                      };
                    });

                    return {
                      code,
                      name: m.salesmen[code].name,
                      stt: m.salesmen[code].stt,
                      volume: m.salesmen[code].volume,
                      uba: smUba,
                      customers: smCustomers
                    };
                  });

                  const safeId = prodCode.replace(/[^a-zA-Z0-9_]/g, '');
                  npdBatch.set(doc(collection(db, 'npd_promopack_metrics'), safeId), {
                    product_code: prodCode,
                    product_description: info.product_description,
                    type: info.type,
                    category: info.category,
                    stt: m.stt,
                    volume: m.volume,
                    uba: productUba,
                    salesmen: salesmenArr,
                    last_updated: new Date().toISOString()
                  }, { merge: false });
                });
                await npdBatch.commit();
              }
            } catch (err) {
              console.error("Error aggregating NPD/Promo metrics:", err);
            }

            // --- TRADE BO HISTORY STACKING ---
            try {
              let totalBsr = 0;
              Object.values(metrics).forEach((m: any) => { totalBsr += m.bsr || 0; });
              const boMonthKey = cobDate.substring(0, 7);
              await setDoc(doc(db, 'trade_bo_history', boMonthKey), {
                [`dates.${cobDate.replace(/-/g, '_')}`]: totalBsr,
                last_updated: new Date().toISOString()
              }, { merge: true });
            } catch (err) {
              console.error("Error saving Trade BO history:", err);
            }
          } 
          else if (category === 'CML (Customer Master List)') {
            setProgress({ step: 'Aggregating CML Baseline & Chunking...', current: 0, total: 100 });
            // Calculate active customers per salesman and group them
            const cmlCounts: Record<string, number> = {};
            const salesmanGroups: Record<string, any[]> = {};
            
            json.forEach((row: any) => {
              const cleanRow = JSON.parse(JSON.stringify(row));
              const salesmanCode = String(cleanRow['SALES REP ID'] || '');
              const status = String(cleanRow['STATUS'] || '').toLowerCase();
              
              if (salesmanCode && (status === 'active/approved' || status === 'active' || status === 'approved')) {
                cmlCounts[salesmanCode] = (cmlCounts[salesmanCode] || 0) + 1;
                
                if (!salesmanGroups[salesmanCode]) salesmanGroups[salesmanCode] = [];
                // Ensure initial metrics are present
                cleanRow.volume = 0;
                cleanRow.netValue = 0;
                cleanRow.gsr = 0;
                cleanRow.bsr = 0;
                cleanRow.isBuying = false;
                salesmanGroups[salesmanCode].push(cleanRow);
              }
            });

            // Save metrics to individual docs (legacy) AND to the 'all' doc
            const cmlBatch = writeBatch(db);
            Object.keys(cmlCounts).forEach(salesmanCode => {
              const docRef = doc(collection(db, 'dashboard_metrics'), salesmanCode);
              cmlBatch.set(docRef, {
                cml_count: cmlCounts[salesmanCode],
                last_updated: new Date().toISOString()
              }, { merge: true });
            });
            await cmlBatch.commit();

            // Also merge cml_count into the 'all' doc so the Sales page can read it
            const allDocSnap = await getDoc(doc(db, 'dashboard_metrics', 'all'));
            const existingAll = allDocSnap.exists() ? allDocSnap.data() : {};
            const updatedAll: Record<string, any> = {};
            Object.keys(cmlCounts).forEach(salesmanCode => {
              updatedAll[salesmanCode] = {
                ...(existingAll[salesmanCode] || {}),
                cml_count: cmlCounts[salesmanCode]
              };
            });
            await setDoc(doc(db, 'dashboard_metrics', 'all'), updatedAll, { merge: true });
            await setDoc(doc(db, 'settings', 'global'), { lastDataUpload: Date.now() }, { merge: true });
            
            // Save Chunks
            setProgress({ step: 'Saving Customer Chunks...', current: 50, total: 100 });
            const cBatch = writeBatch(db);
            Object.keys(salesmanGroups).forEach(salesmanCode => {
              const safeId = String(salesmanCode).replace(/[^a-zA-Z0-9_]/g, '');
              const docRef = doc(collection(db, 'customer_data'), safeId);
              cBatch.set(docRef, { customers: JSON.stringify(salesmanGroups[salesmanCode]) }, { merge: true });
            });
            await cBatch.commit();
          }

          // === NPD & PROMO PACK ITEMS UPLOAD ===
          else if (category === 'NPD & Promo Pack Items') {
            setProgress({ step: 'Uploading NPD & Promo Pack Items...', current: 0, total: json.length });
            const BATCH_SIZE = 450;
            for (let i = 0; i < json.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              json.slice(i, i + BATCH_SIZE).forEach((row: any) => {
                // Normalize keys to lowercase with underscores to prevent mismatch
                const cleanRow: any = {};
                Object.keys(row).forEach(k => {
                  cleanRow[k.trim().toLowerCase().replace(/\s+/g, '_')] = row[k];
                  // Keep original too just in case
                  cleanRow[k] = row[k]; 
                });
                const prodCode = String(cleanRow['product_code'] || cleanRow['Product Code'] || '').replace(/[^a-zA-Z0-9_]/g, '');
                if (prodCode) {
                  batch.set(doc(collection(db, 'npd_promopack_items'), prodCode), cleanRow, { merge: false });
                }
              });
              await batch.commit();
              setProgress({ step: 'Uploading NPD & Promo Pack Items...', current: Math.min(i + BATCH_SIZE, json.length), total: json.length });
            }
            await setDoc(doc(db, 'settings', 'global'), { lastReferenceUpload: Date.now() }, { merge: true });
          }

          // === AGEING REPORT UPLOAD ===
          else if (category === 'Ageing Report') {
            setProgress({ step: 'Clearing old Ageing data...', current: 0, total: 100 });
            // Clear existing ageing_data docs
            const oldAgeingSnap = await getDocs(collection(db, 'ageing_data'));
            const clearBatch = writeBatch(db);
            oldAgeingSnap.forEach(d => clearBatch.delete(d.ref));
            await clearBatch.commit();

            // Write new data in chunks of 200 rows per doc
            const CHUNK_SIZE = 200;
            for (let i = 0; i < json.length; i += CHUNK_SIZE) {
              const chunk = json.slice(i, i + CHUNK_SIZE).map((r: any) => {
                const parsed = JSON.parse(JSON.stringify(r));
                parsed.timestamp = cobDate;
                parsed.source = 'System';
                return parsed;
              });
              const chunkIndex = Math.floor(i / CHUNK_SIZE);
              await setDoc(doc(collection(db, 'ageing_data'), `chunk_${chunkIndex}`), { rows: JSON.stringify(chunk) });
              setProgress({ step: 'Uploading Ageing data...', current: Math.min(i + CHUNK_SIZE, json.length), total: json.length });
            }
            await setDoc(doc(db, 'settings', 'global'), { ageingReportDate: cobDate, lastAgeingUpload: Date.now() }, { merge: true });
          }

          // === WAREHOUSE BO UPLOAD ===
          else if (category === 'Warehouse B.O.') {
            setProgress({ step: 'Clearing old Warehouse B.O. data...', current: 0, total: 100 });
            const oldWSnap = await getDocs(collection(db, 'warehouse_bo_data'));
            const wClearBatch = writeBatch(db);
            oldWSnap.forEach(d => wClearBatch.delete(d.ref));
            await wClearBatch.commit();

            // Normalize rows and convert Excel serial dates
            const formatExcelDateW = (val: any) => {
              if (!val) return '';
              if (typeof val === 'number') {
                const d = new Date((val - 25569) * 86400 * 1000);
                return d.toISOString().split('T')[0];
              }
              return String(val);
            };

            const getValueW = (row: any, keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
              }
              const rowKeys = Object.keys(row);
              for (const k of keys) {
                const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedK);
                if (match && row[match] !== undefined && row[match] !== null) return row[match];
              }
              return '';
            };

            let totalQty = 0;
            const normalizedRows = json.map((row: any) => {
              const qtyVal = parseFloat(getValueW(row, ['qty', 'Qty', 'QTY']) || 0);
              totalQty += qtyVal;
              return {
                date: formatExcelDateW(getValueW(row, ['date', 'Date', 'DATE'])),
                branch_name: String(getValueW(row, ['branch_name', 'Branch Name', 'Branch', 'branch']) || ''),
                category: String(getValueW(row, ['category', 'Category', 'CATEGORY']) || ''),
                product_code: String(getValueW(row, ['product_code', 'Product Code', 'Product_Code']) || ''),
                product_description: String(getValueW(row, ['product_description', 'Product Description', 'Description']) || ''),
                uom: String(getValueW(row, ['UOM', 'uom', 'Uom']) || ''),
                qty: qtyVal,
                srs_reference: String(getValueW(row, ['srs_reference', 'SRS Reference', 'SRS No.']) || '')
              };
            });

            // Write in chunks of 200 rows per doc
            const CHUNK_SIZE = 200;
            for (let i = 0; i < normalizedRows.length; i += CHUNK_SIZE) {
              const chunk = normalizedRows.slice(i, i + CHUNK_SIZE);
              const chunkIndex = Math.floor(i / CHUNK_SIZE);
              await setDoc(doc(collection(db, 'warehouse_bo_data'), `chunk_${chunkIndex}`), { rows: JSON.stringify(chunk) });
              setProgress({ step: 'Uploading Warehouse B.O. data...', current: Math.min(i + CHUNK_SIZE, normalizedRows.length), total: normalizedRows.length });
            }
            // Stack history
            const wMonthKey = cobDate.substring(0, 7);
            await setDoc(doc(db, 'warehouse_bo_history', wMonthKey), {
              [`dates.${cobDate.replace(/-/g, '_')}`]: totalQty,
              last_updated: new Date().toISOString()
            }, { merge: true });
            await setDoc(doc(db, 'settings', 'global'), { lastWarehouseBoUpload: Date.now(), warehouseBoDate: cobDate }, { merge: true });
          }

          // === VAN BO UPLOAD ===
          else if (category === 'Van B.O.') {
            setProgress({ step: 'Clearing old Van B.O. data...', current: 0, total: 100 });
            const oldVSnap = await getDocs(collection(db, 'van_bo_data'));
            const vClearBatch = writeBatch(db);
            oldVSnap.forEach(d => vClearBatch.delete(d.ref));
            await vClearBatch.commit();

            // Normalize rows and convert Excel serial dates
            const formatExcelDate = (val: any) => {
              if (!val) return '';
              if (typeof val === 'number') {
                const d = new Date((val - 25569) * 86400 * 1000);
                return d.toISOString().split('T')[0];
              }
              return String(val);
            };

            const getValue = (row: any, keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
              }
              // Also try case-insensitive match
              const rowKeys = Object.keys(row);
              for (const k of keys) {
                const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedK);
                if (match && row[match] !== undefined && row[match] !== null) return row[match];
              }
              return '';
            };

            let totalQtyVan = 0;
            const normalizedRows = json.map((row: any) => {
              const qtyVal = parseFloat(getValue(row, ['qty', 'Qty', 'QTY']) || 0);
              totalQtyVan += qtyVal;
              return {
                date: formatExcelDate(getValue(row, ['date', 'Date', 'DATE'])),
                branch_name: String(getValue(row, ['branch_name', 'Branch Name', 'Branch', 'branch']) || ''),
                van_code: String(getValue(row, ['van_code', 'Van Code', 'Van', 'van_code']) || ''),
                salesman_code: String(getValue(row, ['salesman_code', 'Salesman Code', 'Salesman_Code']) || ''),
                category: String(getValue(row, ['category', 'Category', 'CATEGORY']) || ''),
                product_code: String(getValue(row, ['product_code', 'Product Code', 'Product_Code', 'ProductCode']) || ''),
                product_description: String(getValue(row, ['product_description', 'Product Description', 'Description', 'product_description']) || ''),
                uom: String(getValue(row, ['UOM', 'uom', 'Uom']) || ''),
                qty: qtyVal
              };
            });

            // Write in chunks of 200 rows per doc (like ageing)
            const CHUNK_SIZE = 200;
            for (let i = 0; i < normalizedRows.length; i += CHUNK_SIZE) {
              const chunk = normalizedRows.slice(i, i + CHUNK_SIZE);
              const chunkIndex = Math.floor(i / CHUNK_SIZE);
              await setDoc(doc(collection(db, 'van_bo_data'), `chunk_${chunkIndex}`), { rows: JSON.stringify(chunk) });
              setProgress({ step: 'Uploading Van B.O. data...', current: Math.min(i + CHUNK_SIZE, normalizedRows.length), total: normalizedRows.length });
            }
            // Stack history
            const vMonthKey = cobDate.substring(0, 7);
            await setDoc(doc(db, 'van_bo_history', vMonthKey), {
              [`dates.${cobDate.replace(/-/g, '_')}`]: totalQtyVan,
              last_updated: new Date().toISOString()
            }, { merge: true });
            await setDoc(doc(db, 'settings', 'global'), { lastVanBoUpload: Date.now(), vanBoDate: cobDate }, { merge: true });
          }

          // === PRICELIST UPLOAD ===
          else if (category === 'Pricelist') {
            setProgress({ step: 'Clearing old Pricelist data...', current: 0, total: 100 });
            const oldPriceSnap = await getDocs(collection(db, 'reference_pricelist'));
            const pClearBatch = writeBatch(db);
            oldPriceSnap.forEach(d => pClearBatch.delete(d.ref));
            await pClearBatch.commit();

            const getValueP = (row: any, keys: string[]) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return row[k];
              }
              const rowKeys = Object.keys(row);
              for (const k of keys) {
                const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedK);
                if (match && row[match] !== undefined && row[match] !== null) return row[match];
              }
              return '';
            };

            const normalizedPrices = json.map((row: any) => ({
              product_code: String(getValueP(row, ['product_code', 'Product Code', 'ProductCode']) || ''),
              product_description: String(getValueP(row, ['product_description', 'Product Description', 'Description']) || ''),
              Case: parseFloat(getValueP(row, ['Case', 'case', 'CASE', 'CS']) || 0),
              Subcase: parseFloat(getValueP(row, ['Subcase', 'subcase', 'SUBCASE', 'SCS', 'Sub Case']) || 0),
              Piece: parseFloat(getValueP(row, ['Piece', 'piece', 'PIECE', 'PC', 'pc']) || 0)
            }));

            const CHUNK_SIZE = 200;
            for (let i = 0; i < normalizedPrices.length; i += CHUNK_SIZE) {
              const chunk = normalizedPrices.slice(i, i + CHUNK_SIZE);
              const chunkIndex = Math.floor(i / CHUNK_SIZE);
              await setDoc(doc(collection(db, 'reference_pricelist'), `chunk_${chunkIndex}`), { rows: JSON.stringify(chunk) });
              setProgress({ step: 'Uploading Pricelist...', current: Math.min(i + CHUNK_SIZE, normalizedPrices.length), total: normalizedPrices.length });
            }
            await setDoc(doc(db, 'settings', 'global'), { lastPricelistUpload: Date.now() }, { merge: true });
          }
          else if (category === 'Product ADS Reference') {
            setProgress({ step: 'Uploading Product ADS Reference...', current: 0, total: 100 });
            const compactMap: Record<string, [string, number | Record<string, number>]> = {};
            json.forEach((row: any) => {
              // Custom getValue wrapper for robustness
              const getValueP = (possibleKeys: string[]) => {
                const rowKeys = Object.keys(row);
                for (const k of possibleKeys) {
                  const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedK);
                  if (match && row[match] !== undefined && row[match] !== null) return row[match];
                }
                return '';
              };

              const code = String(getValueP(['product_code', 'Product Code', 'Item Code', 'itemcode', 'item_code']) || '').trim();
              const desc = String(getValueP(['product_description', 'Product Description', 'Description', 'Item Description']) || '').trim();
              
              const branchAds: Record<string, number> = {};
              let hasAnyAds = false;

              Object.keys(row).forEach(k => {
                const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                // Exclude known identifier columns
                if (!['productcode', 'productdescription', 'description', 'itemcode', 'itemdescription'].includes(lowerK)) {
                  const val = parseFloat(row[k]);
                  if (!isNaN(val) && val > 0) {
                     branchAds[k.trim().toUpperCase()] = val;
                     hasAnyAds = true;
                  }
                }
              });
              
              if (code) {
                // Store either the branch map, or fallback to 0 if none found
                compactMap[code] = [desc, hasAnyAds ? branchAds : 0];
              }
            });
            // Store highly compactly as a single JSON string
            await setDoc(doc(db, 'reference_ads', 'all'), { data: JSON.stringify(compactMap) });
            await setDoc(doc(db, 'settings', 'global'), { lastReferenceUpload: Date.now() }, { merge: true });
          }

          // === ITEM MASTERLIST ===
          else if (category === 'Item Masterlist') {
            const masterMap: Record<string, [string, string]> = {};
            json.forEach((row: any) => {
              const cleanRow = JSON.parse(JSON.stringify(row));
              const code = String(cleanRow['product_code'] || cleanRow['Product Code'] || cleanRow['Item Code'] || '').trim();
              const desc = String(cleanRow['product_description'] || cleanRow['Description'] || cleanRow['Item Description'] || '').trim();
              const cat = String(cleanRow['category'] || cleanRow['Category'] || cleanRow['CATEGORY'] || '').trim();
              
              if (code) {
                masterMap[code] = [desc, cat];
              }
            });
            // Store highly compactly as a single JSON string
            await setDoc(doc(db, 'reference_masterlist', 'all'), { data: JSON.stringify(masterMap) });
            await setDoc(doc(db, 'settings', 'global'), { lastReferenceUpload: Date.now() }, { merge: true });
          }

          // === RAW DATA UPLOAD (legacy reference types) ===
          else if (!['Net Invoiced', 'CML (Customer Master List)'].includes(category)) {
            let collName = 'reference_general';
            if (category === 'VD30 Target') collName = 'vd30_targets';
            if (category === 'STT & UBA Target') collName = 'salesman_targets';
            if (category === 'Team & Service Model Reference') collName = 'reference_team_service';
            if (category === 'Channel Reference') collName = 'reference_channels';
            if (category === 'VD30 Items Reference') collName = 'reference_vd30';
            if (category === 'Geo Hierarchy Reference') collName = 'reference_geo';
            if (category === 'Customer Class') collName = 'reference_customer_classes';
            if (category === 'NPD & Promo Pack Items') collName = 'npd_promopack_items';

            const useAllDoc = ['vd30_targets', 'salesman_targets', 'reference_team_service', 'reference_vd30', 'reference_channels', 'reference_geo'].includes(collName);

            if (useAllDoc) {
              const allDocData: Record<string, any> = {};
              json.forEach((row: any) => {
                const cleanRow = JSON.parse(JSON.stringify(row));
                const safeId = String(cleanRow['salesman_code'] || cleanRow['code'] || cleanRow['product_code'] || cleanRow['Product Code'] || cleanRow['vd30_code'] || Math.random()).replace(/[^a-zA-Z0-9_]/g, '');
                allDocData[safeId] = cleanRow;
              });
              await setDoc(doc(db, collName, 'all'), allDocData, { merge: true });
              setProgress({ step: 'Uploading Raw Data to Firestore...', current: json.length, total: json.length });
            } else {
              const BATCH_SIZE = 450;
              for (let i = 0; i < json.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = json.slice(i, i + BATCH_SIZE);

                chunk.forEach((row: any) => {
                  const cleanRow = JSON.parse(JSON.stringify(row));
                  const safeId = String(cleanRow['salesman_code'] || cleanRow['code'] || cleanRow['product_code'] || cleanRow['Product Code'] || cleanRow['vd30_code'] || Math.random()).replace(/[^a-zA-Z0-9_]/g, '');
                  batch.set(doc(collection(db, collName), safeId), cleanRow, { merge: true });
                });

                await batch.commit();
                setProgress({ step: 'Uploading Raw Data to Firestore...', current: Math.min(i + BATCH_SIZE, json.length), total: json.length });
              }
            }
            await setDoc(doc(db, 'settings', 'global'), { lastReferenceUpload: Date.now() }, { merge: true });
          }

          resolve();
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setSuccess(false);
    setError('');
    setProgress(null);
    
    try {
      await processAndUpload(selectedFile, activeCategory);
      setSuccess(true);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleClearTransactionalData = async () => {
    if (!window.confirm("WARNING: Are you absolutely sure you want to clear ALL transactional data? This cannot be undone!")) return;
    if (!window.confirm("Double checking: This will permanently delete Gamification, Sales, Customers, and B.O. data. Proceed?")) return;

    setClearingData(true);
    setError('');
    setSuccess(false);

    try {
      const collectionsToClear = [
        'dashboard_metrics',
        'customer_data',
        'warehouse_bo_data',
        'van_bo_data',
        'ageing_data',
        'achievements',
        'historical_medals',
        'weekly_commitments',
        'trade_bo_history',
        'van_bo_history',
        'warehouse_bo_history',
        'npd_promopack_metrics'
      ];

      for (const collName of collectionsToClear) {
        const snap = await getDocs(collection(db, collName));
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 450) {
          const chunk = docs.slice(i, i + 450);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      await setDoc(doc(db, 'settings', 'global'), { 
        lastDataUpload: Date.now(),
        lastAgeingUpload: Date.now(),
        lastWarehouseBoUpload: Date.now(),
        lastVanBoUpload: Date.now()
      }, { merge: true });

      alert("All transactional data successfully cleared.");
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to clear data: " + err.message);
    } finally {
      setClearingData(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h2>Data Management</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Upload Excel (.xlsx) files to update platform data.</p>
      </div>

      {/* System Announcement Settings */}
      <div className="glass-panel" style={{ marginBottom: '32px', padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--accent-primary)' }}>System Announcement</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Broadcast a global message to all users (e.g. for maintenance or data updates). Leave empty to clear the announcement.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="Type a message..."
            value={systemAnnouncement}
            onChange={e => setSystemAnnouncement(e.target.value)}
            style={{ flex: 1, padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'white' }}
          />
          <button 
            onClick={handleSaveAnnouncement}
            className="btn btn-primary"
            disabled={savingAnnouncement}
          >
            {savingAnnouncement ? 'Saving...' : 'Broadcast'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Categories Sidebar */}
        <div className="glass-panel" style={{ width: '300px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Data Categories</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadGroups.map(group => (
              <div key={group.name} style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: '12px', marginBottom: '4px', fontWeight: 600 }}>{group.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.items.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => { setActiveCategory(cat); setSuccess(false); setError(''); }}
                      className="btn"
                      style={{ 
                        justifyContent: 'flex-start', 
                        backgroundColor: activeCategory === cat ? 'var(--bg-panel-hover)' : 'transparent',
                        color: activeCategory === cat ? 'var(--accent-primary)' : 'var(--text-main)',
                        border: activeCategory === cat ? '1px solid var(--border)' : '1px solid transparent',
                        padding: '6px 12px',
                        fontSize: '13px'
                      }}
                    >
                      <FileSpreadsheet size={16} style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Area */}
        <div className="glass-panel" style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '18px', color: 'var(--accent-primary)' }}>
            Upload: {activeCategory}
          </h3>
          
          <form onSubmit={handleUpload} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              flex: 1, 
              border: '2px dashed var(--border)', 
              borderRadius: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              padding: '40px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              marginBottom: '24px',
              position: 'relative',
            }}>
              <Upload size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                {selectedFile ? selectedFile.name : 'Click or drag file to this area to upload'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strictly .xlsx files only (Max 15MB)</div>
              <input 
                type="file" 
                accept=".xlsx" 
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={uploading}
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: uploading ? 'not-allowed' : 'pointer', top: 0, left: 0 }} 
              />
            </div>

            {DATE_PICKER_CATEGORIES.includes(activeCategory) && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                  {activeCategory === 'Net Invoiced' ? 'COB Date (Closing of Business)' : 'Report / Upload Date'}
                </label>
                <input 
                  type="date" 
                  value={cobDate}
                  onChange={(e) => setCobDate(e.target.value)}
                  disabled={uploading}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid var(--border)', 
                    borderRadius: '8px', 
                    color: 'white',
                    colorScheme: 'dark'
                  }}
                />
              </div>
            )}

            {progress && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>
                  <span>{progress.step}</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: 'var(--accent-primary)', width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.3s' }}></div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-danger)' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-success)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-success)' }}>
                <CheckCircle size={20} />
                <span>{activeCategory} updated successfully in Firestore!</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={!selectedFile || uploading || clearingData} style={{ width: '100%' }}>
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="animate-spin" /> Processing Data...
                </div>
              ) : 'Upload Data'}
            </button>

            {/* Danger Zone */}
            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ color: 'var(--accent-danger)', fontSize: '16px', marginBottom: '8px' }}>Danger Zone</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Clearing transactional data will delete all Net Invoiced metrics, customer progress, gamification medals, warehouse and van B.O., and ageing data. This is useful for starting a fresh month. Reference data and Targets will NOT be deleted.
              </p>
              <button 
                type="button"
                className="btn"
                onClick={handleClearTransactionalData}
                disabled={clearingData || uploading}
                style={{ width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid var(--accent-danger)', justifyContent: 'center' }}
              >
                {clearingData ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 size={18} className="animate-spin" /> Clearing Data...
                  </div>
                ) : 'Clear All Transactional Data'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DataUpload;
