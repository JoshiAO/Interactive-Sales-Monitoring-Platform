import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { get, set } from 'idb-keyval';

export interface AgeingRow {
  branch: string;
  category: string;
  item_code: string;
  item_description: string;
  ads: number;
  production_date: string;
  expiry_date: string;
  qty: number;
  uom: string;
  days_to_go: number | string;
  idl: string | number;
}

export const useAgeingData = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AgeingRow[]>([]);
  const [reportDate, setReportDate] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const globalDoc = await getDoc(doc(db, 'settings', 'global'));
        const globalData = globalDoc.exists() ? globalDoc.data() : null;
        const lastAgeingUpload = globalData?.lastAgeingUpload || 0;
        const ageingDate = globalData?.ageingReportDate || '';
        setReportDate(ageingDate);

        const cacheKey = 'ageing_data_cache_v3';
        const cachedData = await get(cacheKey);
        const cachedUpload = await get('ageing_lastUpload');
        if (cachedData && cachedUpload === lastAgeingUpload) {
          setRows(cachedData);
          setLoading(false);
          return;
        }

        const snap = await getDocs(collection(db, 'ageing_data'));
        const allRows: AgeingRow[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.rows) {
            const parsed = JSON.parse(data.rows);
            parsed.forEach((r: any) => {
              const getValue = (possibleKeys: string[]) => {
                const keys = Object.keys(r);
                for (const pk of possibleKeys) {
                  const normalizedPk = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const match = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedPk);
                  if (match && r[match] !== undefined && r[match] !== null) return r[match];
                }
                return '';
              };

              const formatExcelDate = (val: any) => {
                if (!val) return '';
                if (typeof val === 'number') {
                  // Convert Excel serial date to JS Date
                  const date = new Date((val - 25569) * 86400 * 1000);
                  return date.toISOString().split('T')[0];
                }
                // If it's already a string, just return it
                return String(val);
              };

              const expiryDateStr = formatExcelDate(getValue(['expiry_date', 'expirydate', 'expdate']));
              
              let daysToGo: number | string = 0;
              if (expiryDateStr) {
                const expiry = new Date(expiryDateStr);
                const now = new Date();
                now.setHours(0,0,0,0);
                expiry.setHours(0,0,0,0);
                const diffTime = expiry.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                daysToGo = diffDays;
              } else {
                daysToGo = parseFloat(getValue(['days_to_go', 'daystogo', 'days']) || 0);
              }

              if (typeof daysToGo === 'number' && daysToGo <= 0) {
                daysToGo = 'Expired';
              }

              allRows.push({
                branch: getValue(['branch']),
                category: getValue(['category']),
                item_code: getValue(['item_code', 'itemcode', 'productcode']),
                item_description: getValue(['item_description', 'itemdescription', 'description', 'productdescription']),
                ads: parseFloat(getValue(['ads']) || 0),
                production_date: formatExcelDate(getValue(['production_date', 'productiondate', 'proddate', 'mfgdate'])),
                expiry_date: expiryDateStr,
                qty: parseFloat(getValue(['qty', 'quantity']) || 0),
                uom: getValue(['uom', 'unit']),
                days_to_go: daysToGo,
                idl: getValue(['idl'])
              });
            });
          }
        });

        await set(cacheKey, allRows);
        await set('ageing_lastUpload', lastAgeingUpload);
        setRows(allRows);
      } catch (err) {
        console.error('Error fetching Ageing data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  return { loading, rows, reportDate };
};
