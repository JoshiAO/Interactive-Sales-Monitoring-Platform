import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useUsersCache } from './useUsersCache';

export interface TradeSalesman {
  code: string;
  name: string;
  photoURL: string;
  stt: number;
  bsr: number;
  gsr: number;
  team: string;
  type: string;
}

export interface TradeBoHistoryPoint {
  date: string;
  totalBsr: number;
}

export interface TradeCustomer {
  id: string;
  name: string;
  barangay: string;
  city: string;
  province: string;
  bsr: number;
}

export const useTradeBoData = (selectedTeam: string = 'all') => {
  const { currentUser, role, salesmanId, team } = useAuth();
  const { usersCache, loading: usersLoading } = useUsersCache();
  const [loading, setLoading] = useState(true);
  const [salesmen, setSalesmen] = useState<TradeSalesman[]>([]);
  const [history, setHistory] = useState<TradeBoHistoryPoint[]>([]);
  const [totalBsr, setTotalBsr] = useState(0);

  useEffect(() => {
    if (!currentUser || usersLoading) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [globalDoc, teamSnap, metricsSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'global')),
          getDoc(doc(db, 'reference_team_service', 'all')),
          getDoc(doc(db, 'dashboard_metrics', 'all'))
        ]);

        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const cobDate = globalData?.cobDate || new Date().toISOString().split('T')[0];

        // Build allowed salesmen set
        const teamRaw = teamSnap.exists() ? teamSnap.data() : {};
        const teamRows = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));
        
        const teamByCode: Record<string, string> = {};
        teamRows.forEach(row => { teamByCode[String(row.salesman_code)] = row.team; });

        let allowedSalesmen = new Set<string>();
        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamRows.forEach(row => {
            if (supervisorTeams.includes(row.team)) allowedSalesmen.add(String(row.salesman_code));
          });
        } else {
          teamRows.forEach(row => {
            if (selectedTeam === 'all' || row.team === selectedTeam) {
              allowedSalesmen.add(String(row.salesman_code));
            }
          });
        }

        // Fetch user info (avatars, names, types)
        const userAvatars: Record<string, string> = {};
        const userNames: Record<string, string> = {};
        const userTypes: Record<string, string> = {};
        usersCache.forEach(u => {
          if (u.salesmanId) {
            userAvatars[String(u.salesmanId)] = u.photoURL || '';
            if (u.name) userNames[String(u.salesmanId)] = u.name;
            if (u.salesmanType) userTypes[String(u.salesmanId)] = u.salesmanType;
          }
        });

        // Fetch metrics (BSR + STT)
        const metricsRaw = metricsSnap.exists() ? metricsSnap.data() : {};
        const salesmenList: TradeSalesman[] = [];
        let bsrTotal = 0;
        
        Object.keys(metricsRaw).forEach(code => {
          const m = metricsRaw[code];
          if (!allowedSalesmen.has(code)) return;
          const bsr = m.bsr || 0;
          bsrTotal += bsr;
          salesmenList.push({
            code,
            name: userNames[code] || m.salesman_name || code,
            photoURL: userAvatars[code] || '',
            stt: m.mtd_net_value || 0,
            bsr,
            gsr: m.gsr || 0,
            team: teamByCode[code] || '',
            type: userTypes[code] || ''
          });
        });
        
        salesmenList.sort((a, b) => b.bsr - a.bsr);

        // Fetch trade BO history for current month
        const monthKey = cobDate.substring(0, 7);
        const historyDoc = await getDoc(doc(db, 'trade_bo_history', monthKey));
        const historyPoints: TradeBoHistoryPoint[] = [];
        if (historyDoc.exists()) {
          const datesData = historyDoc.data().dates || {};
          Object.keys(datesData).sort().forEach(dateKey => {
            historyPoints.push({
              date: dateKey.replace(/_/g, '-'),
              totalBsr: datesData[dateKey] || 0
            });
          });
        }

        setSalesmen(salesmenList);
        setHistory(historyPoints);
        setTotalBsr(bsrTotal);
      } catch (err) {
        console.error('Error fetching Trade BO data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, role, selectedTeam, usersLoading]);

  return { loading, salesmen, history, totalBsr };
};

// Fetch BSR customers for a specific salesman
export const useTradeBoCustomers = (salesmanCode: string | null) => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<TradeCustomer[]>([]);

  useEffect(() => {
    if (!salesmanCode) { setCustomers([]); return; }
    const fetchData = async () => {
      setLoading(true);
      try {
        const safeId = salesmanCode.replace(/[^a-zA-Z0-9_]/g, '');
        const custDoc = await getDoc(doc(db, 'customer_data', safeId));
        if (!custDoc.exists()) { setCustomers([]); return; }
        const data = custDoc.data();
        if (!data.customers) { setCustomers([]); return; }
        const parsed = JSON.parse(data.customers);
        const result: TradeCustomer[] = parsed
          .filter((c: any) => (c.bsr || 0) > 0)
          .map((c: any) => ({
            id: c['CUSTOMER CODE'] || '',
            name: c['STORE NAME / OWNER'] || c['STORE NAME'] || c['CUSTOMER NAME'] || 'Unknown',
            barangay: c['BARANGAY'] || '-',
            city: c['CITY'] || '-',
            province: c['PROVINCE'] || c['REGION'] || '-',
            bsr: c.bsr || 0
          }))
          .sort((a: TradeCustomer, b: TradeCustomer) => b.bsr - a.bsr);
        setCustomers(result);
      } catch (err) {
        console.error('Error fetching Trade BO customers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [salesmanCode]);

  return { loading, customers };
};
