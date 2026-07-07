import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';

export interface NpdPromoItem {
  product_code: string;
  product_description: string;
  type: string; // 'NPD' | 'PROMOPACK'
  category: string;
  stt: number;
  volume: number;
  uba: number;
  salesmen: Array<{ code: string; name: string; stt: number; volume?: number; uba: number; customers?: Array<{code: string; name: string; stt: number; uba: number}> }>;
}

export const useNpdPromoData = (selectedTeam: string = 'all') => {
  const { currentUser, role, salesmanId, team, selectedMonth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NpdPromoItem[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {

        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastDataUpload = globalData?.lastDataUpload || 0;

        const cacheKey = `npd_promo_cache_v3_${currentUser.uid}_${selectedTeam}_${selectedMonth || 'current'}`;
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('npd_promo_lastUpload');
        if (cachedData && cachedUpload === lastDataUpload) {
          setItems(cachedData);
          setLoading(false);
          return;
        }

        // Fetch team reference for role-based filtering
        const teamSnap = await getDoc(doc(db, 'reference_team_service', 'all'));
        const teamRaw = teamSnap.exists() ? teamSnap.data() : {};
        const teamData = Object.keys(teamRaw).map(k => ({ id: k, ...teamRaw[k] }));

        const allowedSalesmen = new Set<string>();
        if (role === 'salesman' && salesmanId) {
          allowedSalesmen.add(String(salesmanId));
        } else if (role === 'supervisor' && team) {
          const supervisorTeams = team.split(',').map((t: string) => t.trim());
          teamData.forEach(row => {
            if (supervisorTeams.includes(row.team)) allowedSalesmen.add(String(row.salesman_code));
          });
        } else if (role === 'manager' || role === 'admin') {
          teamData.forEach(row => {
            if (selectedTeam === 'all' || row.team === selectedTeam) {
              allowedSalesmen.add(String(row.salesman_code));
            }
          });
        }

        const collectionRef = selectedMonth && selectedMonth !== 'current'
          ? collection(db, 'snapshots', selectedMonth, 'npd_promopack_metrics')
          : collection(db, 'npd_promopack_metrics');
        const metricsSnap = await getDocs(collectionRef);
        const result: NpdPromoItem[] = [];

        metricsSnap.forEach(d => {
          const m = d.data() as NpdPromoItem;
          // Filter salesmen array by role
          let filteredSalesmen = m.salesmen || [];
          if (role === 'salesman') {
            filteredSalesmen = filteredSalesmen.filter(s => s.code === salesmanId);
          } else if (role === 'supervisor' || role === 'manager' || role === 'admin') {
            if (selectedTeam !== 'all' || role !== 'admin') {
              filteredSalesmen = filteredSalesmen.filter(s => allowedSalesmen.has(s.code));
            }
          }


          // Recompute totals for filtered salesmen
          const stt = filteredSalesmen.reduce((sum, s) => sum + (s.stt || 0), 0);
          const volume = filteredSalesmen.reduce((sum, s) => sum + (s.volume || 0), 0);
          const uba = filteredSalesmen.reduce((sum, s) => sum + (s.uba || 0), 0);

          result.push({
            product_code: m.product_code,
            product_description: m.product_description,
            type: m.type,
            category: m.category,
            stt: (role === 'admin' || role === 'manager') && selectedTeam === 'all' ? m.stt : stt,
            volume: (role === 'admin' || role === 'manager') && selectedTeam === 'all' ? (m.volume || 0) : volume,
            uba: (role === 'admin' || role === 'manager') && selectedTeam === 'all' ? m.uba : uba,
            salesmen: filteredSalesmen
          });
        });

        result.sort((a, b) => b.stt - a.stt);

        await set(cacheKey, result);
        await set('npd_promo_lastUpload', lastDataUpload);
        setItems(result);
      } catch (err) {
        console.error('Error fetching NPD/Promo data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser, role, selectedTeam, selectedMonth]);

  return { loading, items };
};
