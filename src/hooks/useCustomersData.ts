import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export const useCustomersData = (selectedTeam: string = 'all') => {
  const { currentUser, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const salesmanId = userData?.salesmanId;
        const team = userData?.team;

        const teamSnap = await getDocs(collection(db, 'reference_team_service'));
        let allowedSalesmen = new Set<string>();

        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamSnap.forEach(d => {
            if (supervisorTeams.includes(d.data().team)) allowedSalesmen.add(String(d.data().salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamSnap.forEach(d => {
            const row = d.data();
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
        const chunkSize = 10;
        const chunks = [];
        
        for (let i = 0; i < salesmenArray.length; i += chunkSize) {
          chunks.push(salesmenArray.slice(i, i + chunkSize));
        }

        // Use Promise.all to fetch chunks concurrently
        const fetchPromises = chunks.map(chunk => 
          getDocs(query(collection(db, 'customers'), where('SALES REP ID', 'in', chunk)))
        );

        const snapshots = await Promise.all(fetchPromises);
        
        snapshots.forEach(snap => {
          snap.forEach(d => {
            const c = d.data();
            customerList.push({
              id: c['CUSTOMER CODE'] || d.id,
              name: c['STORE NAME / OWNER'] || c['STORE NAME'] || c['CUSTOMER NAME'] || 'Unknown Store',
              barangay: c['BARANGAY'] || '-',
              city: c['CITY'] || '-',
              province: c['PROVINCE'] || c['REGION'] || '-',
              status: c['STATUS'] || '',
              volume: c.volume || 0,
              netValue: c.netValue || 0,
              gsr: c.gsr || 0,
              bsr: c.bsr || 0,
              isBuying: c.isBuying || false
            });
          });
        });

        // Sort alphabetically
        customerList.sort((a, b) => a.name.localeCompare(b.name));
        
        setCustomers(customerList);
      } catch (err) {
        console.error("Error fetching customers:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, role, selectedTeam]);

  return { loading, customers };
};
