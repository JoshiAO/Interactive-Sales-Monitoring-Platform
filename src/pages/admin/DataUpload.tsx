import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const uploadCategories = [
  'Net Invoiced',
  'CML (Customer Master List)',
  'STT & UBA Target',
  'VD30 Target',
  'Item Category Reference',
  'Channel Reference',
  'VD30 Items Reference',
  'Geo Hierarchy Reference',
  'Team & Service Model Reference'
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

const DataUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(uploadCategories[0]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cobDate, setCobDate] = useState<string>(new Date().toISOString().split('T')[0]);

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
                  customerMetrics[cNumStr] = { volume: 0, netValue: 0, gsr: 0, bsr: 0, isBuying: false };
                }
                customerMetrics[cNumStr].volume += volume;
                customerMetrics[cNumStr].netValue += netValue;
                customerMetrics[cNumStr].gsr += gsr;
                customerMetrics[cNumStr].bsr += bsr;
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
                } else {
                   c.volume = 0;
                   c.netValue = 0;
                   c.gsr = 0;
                   c.bsr = 0;
                   c.isBuying = false;
                }
              });
              
              chunkBatch.set(d.ref, { customers: JSON.stringify(parsedCustomers) }, { merge: true });
            });
            
            await chunkBatch.commit();

            setProgress({ step: 'Saving Aggregated Dashboards...', current: 80, total: 100 });
            const metricsBatch = writeBatch(db);
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
                    if (weekNet > 0) activeWeeks++;
                  });
                  
                  // Ensure they fall into at least F1 if they are UBA
                  if (activeWeeks === 0) activeWeeks = 1;

                  if (activeWeeks === 1) f1++;
                  else if (activeWeeks === 2) f2++;
                  else if (activeWeeks === 3) f3++;
                  else if (activeWeeks >= 4) f4++;
                }
              });

              const docRef = doc(collection(db, 'dashboard_metrics'), salesmanCode);
              metricsBatch.set(docRef, {
                salesman_code: m.salesman_code,
                salesman_name: m.salesman_name,
                mtd_net_value: m.mtd_net_value,
                mtd_volume: m.mtd_volume,
                gsr: m.gsr,
                bsr: m.bsr,
                uba: finalUba,
                vd30_placements: finalVd30,
                categories: m.categories,
                channels: m.channels,
                brgy: m.brgy,
                town: m.town,
                frequency: { f1, f2, f3, f4 },
                last_updated: new Date().toISOString()
              }, { merge: true });
            });
            await metricsBatch.commit();
            
            // Save COB Date globally
            await setDoc(doc(db, 'settings', 'global'), { cobDate, lastDataUpload: Date.now() }, { merge: true });

            // --- DAILY ACHIEVEMENTS STACKING ---
            setProgress({ step: 'Calculating Daily Achievements...', current: 90, total: 100 });
            try {
              // 1. Fetch all necessary data
              const [metricsSnap, sttSnap, vd30Snap, usersSnap, settingsSnap] = await Promise.all([
                getDocs(collection(db, 'dashboard_metrics')),
                getDocs(collection(db, 'salesman_targets')),
                getDocs(collection(db, 'vd30_targets')),
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
              sttSnap.forEach((t: any) => {
                 const d = t.data();
                 targetsMap[t.id] = { target: parseFloat(d.stt_target) || 0, ubaTarget: parseFloat(d['uba target']) || 0, vd30TargetMap: {} };
              });
              vd30Snap.forEach((t: any) => {
                 const d = t.data();
                 if (!targetsMap[t.id]) targetsMap[t.id] = { target: 0, ubaTarget: 0, vd30TargetMap: {} };
                 Object.keys(d).forEach(k => {
                   if (k.startsWith('F')) {
                     targetsMap[t.id].vd30TargetMap[k] = parseFloat(d[k]) || 0;
                   }
                 });
              });

              // Map metrics and calculate VD30 hits
              const salesmenRankingData: any[] = [];
              metricsSnap.forEach((m: any) => {
                 const d = m.data();
                 const sId = m.id;
                 const type = userTypes[sId];
                 if (!type) return; // EXCLUDE UNASSIGNED

                 const targetInfo = targetsMap[sId] || { target: 0, ubaTarget: 0, vd30TargetMap: {} };
                 
                 let vd30HitCount = 0;
                 let vd30TargetCount = 0;
                 Object.keys(targetInfo.vd30TargetMap).forEach(k => {
                    const tgt = targetInfo.vd30TargetMap[k];
                    if (tgt > 0) {
                      vd30TargetCount++;
                      const act = (d.vd30_placements && d.vd30_placements[k]) || 0;
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
              const dailyPointsMap: Record<string, { gold: number, silver: number, bronze: number, points: number }> = {};
              const assignMedals = (sortedList: any[]) => {
                [5, 3, 1].forEach((points, idx) => {
                  if (sortedList[idx]) {
                    const id = sortedList[idx].id;
                    if (!dailyPointsMap[id]) dailyPointsMap[id] = { gold: 0, silver: 0, bronze: 0, points: 0 };
                    dailyPointsMap[id].points += points;
                    if (points === 5) dailyPointsMap[id].gold += 1;
                    else if (points === 3) dailyPointsMap[id].silver += 1;
                    else if (points === 1) dailyPointsMap[id].bronze += 1;
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

                  assignMedals(sttSorted);
                  assignMedals(ubaSorted);
                  assignMedals(vd30Sorted);
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

            // Save metrics
            const cmlBatch = writeBatch(db);
            Object.keys(cmlCounts).forEach(salesmanCode => {
              const docRef = doc(collection(db, 'dashboard_metrics'), salesmanCode);
              cmlBatch.set(docRef, {
                cml_count: cmlCounts[salesmanCode],
                last_updated: new Date().toISOString()
              }, { merge: true });
            });
            await cmlBatch.commit();
            
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

          // === RAW DATA UPLOAD ===
          if (category !== 'Net Invoiced') {
            const BATCH_SIZE = 450;
            for (let i = 0; i < json.length; i += BATCH_SIZE) {
              const batch = writeBatch(db);
              const chunk = json.slice(i, i + BATCH_SIZE);

              chunk.forEach((row: any) => {
                // Firebase rejects undefined values. JSON stringify strictly drops them.
                const cleanRow = JSON.parse(JSON.stringify(row));

                if (category === 'CML (Customer Master List)') {
                  // Customer chunks are handled entirely in the aggregation block above
                }
                else if (category === 'VD30 Target' || category === 'STT & UBA Target' || category === 'Team & Service Model Reference') {
                  const salesmanCode = cleanRow['salesman_code'];
                  if (salesmanCode) {
                    const safeId = String(salesmanCode).replace(/[^a-zA-Z0-9_]/g, '');
                    let collName = 'reference_general';
                    if (category === 'VD30 Target') collName = 'vd30_targets';
                    if (category === 'STT & UBA Target') collName = 'salesman_targets';
                    if (category === 'Team & Service Model Reference') collName = 'reference_team_service';
                    
                    const docRef = doc(collection(db, collName), safeId);
                    batch.set(docRef, cleanRow, { merge: true });
                  }
                }
                else {
                  const safeId = String(cleanRow['code'] || cleanRow['product_code'] || cleanRow['vd30_code'] || Math.random()).replace(/[^a-zA-Z0-9_]/g, '');
                  let collName = 'reference_general';
                  if (category === 'Item Category Reference') collName = 'reference_categories';
                  if (category === 'Channel Reference') collName = 'reference_channels';
                  if (category === 'VD30 Items Reference') collName = 'reference_vd30';
                  if (category === 'Geo Hierarchy Reference') collName = 'reference_geo';
                  if (category === 'Customer Class') collName = 'reference_customer_classes';
                  
                  const docRef = doc(collection(db, collName), safeId);
                  batch.set(docRef, cleanRow, { merge: true });
                }
              });

              await batch.commit();
              setProgress({ step: 'Uploading Raw Data to Firestore...', current: Math.min(i + BATCH_SIZE, json.length), total: json.length });
            }

            // Save reference update timestamp globally (CML and all other references)
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

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '24px' }}>
        <h2>Data Management</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Upload Excel (.xlsx) files to update platform data.</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Categories Sidebar */}
        <div className="glass-panel" style={{ width: '300px', flexShrink: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Data Categories</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadCategories.map(cat => (
              <button 
                key={cat}
                onClick={() => { setActiveCategory(cat); setSuccess(false); setError(''); }}
                className="btn"
                style={{ 
                  justifyContent: 'flex-start', 
                  backgroundColor: activeCategory === cat ? 'var(--bg-panel-hover)' : 'transparent',
                  color: activeCategory === cat ? 'var(--accent-primary)' : 'var(--text-main)',
                  border: activeCategory === cat ? '1px solid var(--border)' : '1px solid transparent'
                }}
              >
                <FileSpreadsheet size={16} />
                {cat}
              </button>
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

            {activeCategory === 'Net Invoiced' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>COB Date (Closing of Business)</label>
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

            <button type="submit" className="btn btn-primary" disabled={!selectedFile || uploading} style={{ width: '100%' }}>
              {uploading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="animate-spin" /> Processing Data...
                </div>
              ) : 'Upload Data'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DataUpload;
