import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useUsersCache } from './useUsersCache';

export interface SalesmanInfo {
  code: string;
  name: string;
}

export const useSalesmenList = (selectedTeam: string = 'all') => {
  const { currentUser, role, salesmanId, team } = useAuth();
  const { usersCache, loading: usersLoading } = useUsersCache();
  const [loading, setLoading] = useState(true);
  const [salesmen, setSalesmen] = useState<SalesmanInfo[]>([]);

  useEffect(() => {
    if (!currentUser || usersLoading) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [teamSnap, metricsSnap] = await Promise.all([
          getDoc(doc(db, 'reference_team_service', 'all')),
          getDoc(doc(db, 'dashboard_metrics', 'all'))
        ]);

        const teamRaw = teamSnap.exists() ? teamSnap.data() : {};
        const teamData = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));

        const metricsRaw = metricsSnap.exists() ? metricsSnap.data() : {};
        const metricsData = Object.keys(metricsRaw).map(k => ({ id: k, ...metricsRaw[k] }));

        const allowedSalesmen = new Set<string>();

        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamData.forEach(d => {
            if (supervisorTeams.includes(d.team)) allowedSalesmen.add(String(d.salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamData.forEach(d => {
            if (selectedTeam === 'all' || d.team === selectedTeam) {
              allowedSalesmen.add(String(d.salesman_code));
            }
          });
        }

        const nameMap: Record<string, string> = {};
        
        // Try to get names from users
        usersCache.forEach(u => {
          if (u.salesmanId && u.name) {
            nameMap[String(u.salesmanId)] = u.name;
          }
        });

        // Fallback to metrics
        metricsData.forEach(m => {
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
  }, [currentUser, role, selectedTeam, usersLoading, salesmanId, team]);

  return { loading, salesmen };
};
