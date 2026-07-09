import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';

export const useCustomersData = (selectedTeam: string = 'all') => {
  const { currentUser, role, salesmanId, team, selectedMonth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {

        // Fetch COB Date and lastUpload for cache validation
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastDataUpload = globalData?.lastDataUpload || 0;
        const lastReferenceUpload = globalData?.lastReferenceUpload || 0;

        const cacheKey = `customers_cache_v6_${currentUser.uid}_${selectedTeam}`;
        const cachedData = await get(cacheKey);
        const cachedLastUpload = await get('customers_lastUpload');

        if (cachedData && cachedLastUpload === lastDataUpload) {
          setCustomers(cachedData);
          setLoading(false);
          return;
        }

        let teamSnapDocs: any[] = [];
        const customersRawData: Record<string, string> = {};

        if (selectedMonth && selectedMonth !== 'current') {
          const snapSnap = await getDoc(doc(db, 'snapshots', selectedMonth));
          if (snapSnap.exists()) {
             const teamRaw = snapSnap.data().reference_team_service || {};
             teamSnapDocs = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));
          }
          const custSnapSnap = await getDocs(collection(db, 'snapshots', selectedMonth, 'customers'));
          custSnapSnap.forEach(d => {
             const custData = d.data();
             if (custData.customers) {
               customersRawData[d.id] = custData.customers;
             }
          });
        } else {
          const teamCacheKey = 'customers_team_ref_cache_v1';
          const cachedTeamRef = await get(teamCacheKey);
          const cachedRefUpload = await get('customers_lastReferenceUpload');

          if (cachedTeamRef && cachedRefUpload === lastReferenceUpload) {
            teamSnapDocs = cachedTeamRef;
          } else {
            const teamSnap = await getDoc(doc(db, 'reference_team_service', 'all'));
            const teamRaw = teamSnap.exists() ? teamSnap.data() : {};
            teamSnapDocs = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));
            await set(teamCacheKey, teamSnapDocs);
            await set('customers_lastReferenceUpload', lastReferenceUpload);
          }
        }

        const allowedSalesmen = new Set<string>();

        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamSnapDocs.forEach(row => {
            if (supervisorTeams.includes(row.team)) allowedSalesmen.add(String(row.salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamSnapDocs.forEach(row => {
            if (selectedTeam === 'all' || row.team === selectedTeam) {
              allowedSalesmen.add(String(row.salesman_code));
            }
          });
        }

        const salesmenArray = Array.from(allowedSalesmen);
        if (salesmenArray.length === 0) {
          setCustomers([]);
          setLoading(false);
          return;
        }

        const customerList: any[] = [];
        if (selectedMonth && selectedMonth !== 'current') {
          salesmenArray.forEach(id => {
            const cData = customersRawData[id];
            if (cData) {
              const parsed = JSON.parse(cData);
              parsed.forEach((c: any) => {
                customerList.push({
                  id: c['CUSTOMER CODE'],
                  name: c['STORE NAME / OWNER'] || c['STORE NAME'] || c['CUSTOMER NAME'] || 'Unknown Store',
                  barangay: c['BARANGAY'] || '-',
                  city: c['CITY'] || '-',
                  province: c['PROVINCE'] || c['REGION'] || '-',
                  status: c['STATUS'] || '',
                  salesmanId: String(c['SALES REP ID'] || ''),
                  volume: c.volume || 0,
                  netValue: c.netValue || 0,
                  gsr: c.gsr || 0,
                  bsr: c.bsr || 0,
                  isBuying: c.isBuying || false,
                  newCustomer: String(c['NEW CUSTOMER'] || '').trim().toUpperCase() === 'YES',
                  notInCml: String(c['NOT IN CML'] || '').trim().toUpperCase() === 'YES',
                  coverageDay: String(c['COVERAGE DAY'] || '').trim().toUpperCase(),
                  wklyCoverage: String(c['WKLY COVERAGE'] || '').trim().toUpperCase()
                });
              });
            }
          });
        } else {
          const chunkSize = 10;
          const chunks = [];
          
          for (let i = 0; i < salesmenArray.length; i += chunkSize) {
            chunks.push(salesmenArray.slice(i, i + chunkSize));
          }

          // Use Promise.all to fetch chunks concurrently
          const fetchPromises = chunks.map(chunk => {
            const safeChunk = chunk.map(id => String(id).replace(/[^a-zA-Z0-9_]/g, ''));
            return getDocs(query(collection(db, 'customer_data'), where(documentId(), 'in', safeChunk)));
          });

          const snapshots = await Promise.all(fetchPromises);
          
          snapshots.forEach(snap => {
            snap.forEach(d => {
              const data = d.data();
              if (!data.customers) return;
              
              const parsed = JSON.parse(data.customers);
              parsed.forEach((c: any) => {
                customerList.push({
                  id: c['CUSTOMER CODE'],
                  name: c['STORE NAME / OWNER'] || c['STORE NAME'] || c['CUSTOMER NAME'] || 'Unknown Store',
                  barangay: c['BARANGAY'] || '-',
                  city: c['CITY'] || '-',
                  province: c['PROVINCE'] || c['REGION'] || '-',
                  status: c['STATUS'] || '',
                  salesmanId: String(c['SALES REP ID'] || ''),
                  volume: c.volume || 0,
                  netValue: c.netValue || 0,
                  gsr: c.gsr || 0,
                  bsr: c.bsr || 0,
                  isBuying: c.isBuying || false,
                  newCustomer: String(c['NEW CUSTOMER'] || '').trim().toUpperCase() === 'YES',
                  notInCml: String(c['NOT IN CML'] || '').trim().toUpperCase() === 'YES',
                  coverageDay: String(c['COVERAGE DAY'] || '').trim().toUpperCase(),
                  wklyCoverage: String(c['WKLY COVERAGE'] || '').trim().toUpperCase()
                });
              });
            });
          });
        }

        // Sort alphabetically
        customerList.sort((a, b) => a.name.localeCompare(b.name));
        
        // Save to cache
        try {
          await set(cacheKey, customerList);
          if (lastDataUpload) {
            await set('customers_lastUpload', lastDataUpload);
          }
        } catch (e) {
          console.warn("Could not save customers to IndexedDB:", e);
        }
        
        setCustomers(customerList);
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, role, selectedTeam, selectedMonth, salesmanId, team]);

  return { loading, customers };
};
