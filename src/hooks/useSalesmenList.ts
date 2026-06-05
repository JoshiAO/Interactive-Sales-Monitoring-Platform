import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export interface SalesmanInfo {
  code: string;
  name: string;
}

export const useSalesmenList = (selectedTeam: string = 'all') => {
  const { currentUser, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salesmen, setSalesmen] = useState<SalesmanInfo[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const salesmanId = userData?.salesmanId;
        const team = userData?.team;

        const [teamSnap, metricsSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'reference_team_service')),
          getDocs(collection(db, 'dashboard_metrics')),
          getDocs(collection(db, 'users'))
        ]);

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

        const nameMap: Record<string, string> = {};
        
        // Try to get names from users
        usersSnap.forEach(d => {
          const u = d.data();
          if (u.salesmanId && u.name) {
            nameMap[String(u.salesmanId)] = u.name;
          }
        });

        // Fallback to metrics
        metricsSnap.forEach(d => {
          const m = d.data();
          if (m.salesman_code && m.salesman_name && !nameMap[m.salesman_code]) {
            nameMap[String(m.salesman_code)] = m.salesman_name;
          }
        });

        const list: SalesmanInfo[] = Array.from(allowedSalesmen).map(code => ({
          code,
          name: nameMap[code] || 'Unknown Salesman'
        }));

        list.sort((a, b) => a.name.localeCompare(b.name));
        setSalesmen(list);

      } catch (err) {
        console.error("Error fetching salesmen:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [currentUser, role, selectedTeam]);

  return { loading, salesmen };
};
